# 12. Forgot / Reset Password

What happens when someone **forgets** their password and can't log in at all? They
can't use the "change password" door from file 11 (that one needs you to be logged
in). So we need a separate "I'm locked out, help me back in" flow. That's this.

## The idea (in real life)

It's like losing your house key:
1. You tell the locksmith "I'm locked out" (**forgot-password**).
2. They give you a **one-time, time-limited pass** to prove it's really you.
3. You use that pass to set a **brand-new key** (**reset-password**).
4. The pass only works **once** and **expires** quickly.

## The two new doors

| Method | Path | What it does |
| --- | --- | --- |
| POST | `/api/v1/auth/forgot-password` | "I forgot" → creates a reset token |
| POST | `/api/v1/auth/reset-password` | "Here's my token + new password" |

## A super important safety rule: don't reveal who has an account

When someone asks to reset `bob@example.com`, we must **not** tell them whether
that email is registered. If we said "no such user," a bad person could use the
form to discover which emails have accounts (called **account enumeration**). So
`forgot-password` **always** responds the same way, whether the email exists or
not.

```ts
async requestPasswordReset(email: string): Promise<{ resetToken?: string }> {
  const user = await this.prisma.user.findUnique({ where: { email } });
  if (!user) {
    return {};            // same calm response, no hint that it doesn't exist
  }
  ...
}
```

## Creating the reset token

```ts
const raw = randomBytes(48).toString("base64url");   // unguessable secret
const tokenHash = await argon2.hash(raw);             // store only the HASH
const ttlMs = this.parseDurationMs(this.config.get("RESET_TOKEN_TTL", "1h"));
const record = await this.prisma.passwordResetToken.create({
  data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + ttlMs) },
});
const token = `${record.id}.${raw}`;
```

This is the **same pattern** as refresh tokens (file 6): make a random secret,
store only its Argon2 **hash**, hand back `id.secret`. The big differences:
- It lives in its own table, `password_reset_tokens` (see the schema, file 3).
- It expires fast — **1 hour** by default (a locked-out person acts soon; a short
  window is safer).

### Where does the token go? (email — not built yet)

In a finished app, we'd **email** this token as a link
(`.../reset?token=...`). We haven't built the email service yet, so for now we:

```ts
this.logger.log(`Password reset requested for ${email}. Reset token (dev): ${token}`);
const isProd = this.config.get("NODE_ENV") === "production";
return isProd ? {} : { resetToken: token };
```

- We **log** the token on the server so a developer can grab it.
- Outside production we also **return** it in the response, so we can test the
  flow without an inbox. In production we return nothing (the email will carry it).

> **Why is returning the token in dev OK but not in prod?** In dev there are no
> real users or secrets — it's just convenient. In production, putting the token
> in the HTTP response would let anyone reset any account they can name. The
> `NODE_ENV` check makes sure that never happens live. (There's a `// TODO` in the
> code to swap this for a real email send.)

## Using the token to set a new password

```ts
async resetPassword(token: string, newPassword: string): Promise<void> {
  const { id, raw } = this.splitToken(token);

  const record = await this.prisma.passwordResetToken.findUnique({ where: { id } });
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw new UnauthorizedException("Invalid or expired reset token");
  }

  const matches = await argon2.verify(record.tokenHash, raw);
  if (!matches) {
    throw new UnauthorizedException("Invalid or expired reset token");
  }

  const passwordHash = await argon2.hash(newPassword);

  await this.prisma.$transaction([
    this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    this.prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}
```

Step by step — the token is rejected if **any** of these is true:
- it doesn't exist,
- it was **already used** (`usedAt` is set) — single-use,
- it's **expired**,
- the secret doesn't match the stored hash.

If it passes, we do three things **together** in one `$transaction` (all-or-nothing,
from file 11):
1. set the new password hash,
2. mark the reset token **used** (so it can't work twice),
3. **revoke all refresh tokens** (kick out any existing sessions).

## A real bug we caught while testing (great lesson!)

Our first version had a `splitToken` helper that just chopped `id.secret` apart
and trusted the `id`. When we tested with a **garbage** token (`"garbage.token"`),
the service returned **500 (server crashed)** instead of a clean **401**.

**Why?** Our `id` column is a **UUID** type in PostgreSQL. When we asked the
database to find a row with id `"garbage"`, Postgres couldn't even read `"garbage"`
as a UUID, so it threw an error — which surfaced as a 500.

**The fix:** make `splitToken` check the id is a real UUID *before* touching the
database, and reject it as a normal `401` if not:

```ts
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuidPattern.test(id) || raw.length === 0) {
  throw new UnauthorizedException("Malformed token");
}
```

> **Lesson:** never let unchecked outside input reach the database. A 500 means
> *we* crashed (our fault); a 401 means *they* sent something invalid (their
> fault). We want the second. This fix also protects the **refresh** flow, which
> uses the same helper.

## What we verified live

forgot-password (known email) → got a token · forgot-password (unknown email) →
same empty response (no enumeration) · reset-password → 204 · login with the new
password → works · login with the old password → 401 · old refresh token →
revoked (401) · reusing the reset token → 401 (single-use) · garbage token → 401
(not 500). All green. ✅

## Recap

- **forgot-password** never reveals whether an email exists, and makes a short-lived,
  single-use, **hashed** reset token (emailed in the real product; logged/returned
  in dev for now).
- **reset-password** validates the token, sets the new password, marks the token
  used, and revokes all sessions — all in one `$transaction`.
- Always validate outside input (the UUID check) so bad data gives a clean `401`,
  never a `500`.

Back to the [index](README.md).
