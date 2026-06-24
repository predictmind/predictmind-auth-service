# 13. Session Management

A "session" is one **logged-in device** — really, one **refresh token** we gave
out (file 6). People want to see "where am I logged in?" and be able to kick out a
device (lost phone) or **log out everywhere**. That's session management.

## The three new doors (all protected)

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/v1/auth/sessions` | List my active sessions |
| DELETE | `/api/v1/auth/sessions/:id` | End one specific session |
| POST | `/api/v1/auth/logout-all` | End every session |

All three sit behind the `JwtAuthGuard` — you must be logged in, and you can only
ever touch **your own** sessions.

## Listing sessions (and a privacy rule)

```ts
async listSessions(userId: string): Promise<SessionInfo[]> {
  return this.prisma.refreshToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, expiresAt: true },
  });
}
```

- `where` finds tokens that belong to this user, are **not revoked**
  (`revokedAt: null`), and are **not expired** (`expiresAt` greater than now —
  `gt` means "greater than"). Those are exactly the *active* sessions.
- `orderBy: { createdAt: "desc" }` — newest first.
- **`select`** is the important safety bit: we ask for **only** `id`, `createdAt`,
  and `expiresAt`. We deliberately **do not** select `tokenHash`. So there's no
  way the secret hash leaks out through this list. (We tested that the response
  has only those three fields.)

`SessionInfo` is a small interface describing that safe shape:

```ts
export interface SessionInfo {
  id: string;
  createdAt: Date;
  expiresAt: Date;
}
```

## Revoking one session (scoped to the owner)

```ts
async revokeSession(userId: string, sessionId: string): Promise<void> {
  await this.prisma.refreshToken.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
```

The key detail is `where: { id: sessionId, userId }` — we match **both** the
session id **and** the current user's id. So even if someone sends a session id
that belongs to *someone else*, nothing happens (the `where` won't match). You can
only end your **own** sessions. Using `updateMany` means "no match" simply does
nothing instead of erroring.

## Logging out everywhere

```ts
async logoutAll(userId: string): Promise<void> {
  await this.prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
```

Revoke **all** of this user's active sessions at once. Perfect for "I think my
account was hacked — sign me out of everything."

## The controller, and a neat built-in guard

```ts
@Delete("sessions/:id")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@HttpCode(HttpStatus.NO_CONTENT)
async revokeSession(
  @CurrentUser() current: JwtPayload,
  @Param("id", ParseUUIDPipe) id: string,
): Promise<void> {
  await this.auth.revokeSession(current.sub, id);
}
```

- `@Delete("sessions/:id")` — the `:id` is a **path parameter** (part of the URL,
  like `/sessions/abc-123`). `@Param("id", ...)` reads it.
- `ParseUUIDPipe` — a **built-in Nest pipe** that checks the `:id` is a real UUID
  **before** our code runs. If it's garbage, the client gets a clean `400` — and,
  importantly, the bad value never reaches the database (avoiding the 500 problem
  we learned about in file 12). Using the framework's pipe is cleaner than writing
  our own check here.
- `@HttpCode(HttpStatus.NO_CONTENT)` — returns `204` (done, nothing to send back).

> **Why is `ParseUUIDPipe` nicer than the manual UUID regex from file 12?** For a
> URL parameter, Nest already has a tested tool — so we use it. In file 12 the id
> was *inside* a token string (not a separate parameter), so there we had to check
> it ourselves. Right tool for each spot.

## What we verified live

Logged in 3 times → **3** sessions listed (only `id`, `createdAt`, `expiresAt` —
no token hash) → revoked one → **2** left → a garbage session id → **400** →
`logout-all` → an old session's refresh token now fails (**401**) and the list is
**empty** → asking for sessions without a token → **401**. All green. ✅

## This completes Epic E1 (Authentication)

With this, the auth service covers the whole story:
- **S1.1** register · **S1.2** login + JWT/refresh · **S1.3** forgot/reset
  password · **S1.4** profile + change password · **S1.5** session management.

## Recap

- A **session** = one refresh token (one logged-in device).
- List shows only **safe** fields (never the hash) thanks to Prisma `select`.
- Revoking is **scoped to the owner** so you can't touch other people's sessions.
- `ParseUUIDPipe` validates URL ids up front → clean `400`, never a `500`.

Back to the [index](README.md).
