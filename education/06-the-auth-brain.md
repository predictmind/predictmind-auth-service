# 6. The Auth Brain (`auth.service.ts`)

This is the most important file. It holds the actual logic for signing up, logging
in, refreshing passes, and logging out. We'll learn a few key ideas first, then
read the file piece by piece.

## Key idea 1: never store real passwords — "hash" them

If we saved real passwords and someone stole our database, they'd have everyone's
password. Disaster. So we **hash** passwords.

**Hashing** is like a magic blender: you put the password in, it turns into a
scrambled mush, and **you can't un-blend it** back into the password. The same
password always blends to the same mush, so to check a login we blend what they
typed and compare the mush.

We use **Argon2** (specifically *Argon2id*), a top-quality password blender that
also makes the blending *slow on purpose*, so hackers can't try millions of
guesses per second.

> **Why Argon2 and not something like MD5/SHA?** Those old ones are *fast*, which
> is bad for passwords (fast = easy to brute-force). Argon2 is modern, slow, and
> the recommended choice for passwords today.

## Key idea 2: tokens — your pass to get in

After you log in, we give you a **token** so you don't have to send your password
on every single request. Two kinds:

- **Access token (a JWT):** a short-lived pass (15 minutes). Like a **wristband**
  at a theme park — flash it to get on rides (access pages) without showing your
  ID every time. A **JWT** ("JSON Web Token") is a signed piece of text holding
  who you are. It's *signed* with a secret, so we can tell if someone faked it.
- **Refresh token:** a longer-lived pass (30 days) used only to get a *new*
  wristband when the old one expires. Like a **movie-ticket stub** you show to
  re-enter. We store these in the database (hashed) so we can cancel them.

> **Why two tokens?** Access tokens are short so that if one leaks, it's useless
> fast. Refresh tokens last longer for convenience but can be **revoked** (logout)
> because we track them in the database. Best of both worlds.

## Key idea 3: async / await — waiting without freezing

Some jobs take time: talking to the database, blending a password. We don't want
the whole program to freeze while waiting. So those functions are `async`, and we
put `await` in front of slow calls. `await` means "pause *this task* here until
the result is ready, but let other work continue." A function marked `async`
always hands back a **Promise** — a little "I'll get back to you" ticket.

Now, the file.

## The imports

```ts
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Prisma, User } from "@prisma/client";
import * as argon2 from "argon2";
import { randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDto } from "./dto/register.dto";
```

- `ConflictException`, `UnauthorizedException` — ready-made errors from Nest.
  Throwing `ConflictException` automatically sends the client a `409 Conflict`
  ("that already exists"); `UnauthorizedException` sends `401` ("not allowed").
- `Injectable` — the sticker so Nest can manage this service.
- `ConfigService` — reads our settings/secrets (from `.env`).
- `JwtService` — makes and checks JWT access tokens.
- `Prisma, User` — types generated from our schema. `User` is the shape of a user
  row; `Prisma` holds helper types.
- `import * as argon2 from "argon2"` — bring in the whole password-blender tool
  under the name `argon2`.
- `randomBytes` from `crypto` — Node's built-in tool to make **random** data
  (for un-guessable refresh tokens).
- `PrismaService`, `RegisterDto` — our own database helper and sign-up form.

## The little type definitions

```ts
export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export type SafeUser = Omit<User, "passwordHash">;

export interface AuthResult {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
}
```

- An `interface` describes the **shape** of an object (what fields it has).
- `JwtPayload` is what we hide inside an access token: `sub` (short for
  "subject" = the user's id — a standard JWT name), their `email`, and `role`.
- `SafeUser = Omit<User, "passwordHash">` — take the full `User` shape but
  **remove** `passwordHash`. We use this so we *never accidentally send the
  password hash back to the client*. `Omit` is a TypeScript helper meaning "all
  of this, except that field."
- `AuthResult` is what we return after signup/login: the safe user plus both
  tokens.

## The class and its tools

```ts
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}
```

- `@Injectable()` — Nest can create and share this service.
- The `constructor` **asks** for three tools (dependency injection, from file 4):
  the database helper, the token maker, and the settings reader.
- `private readonly prisma` — a shortcut that both stores the tool on the object
  and protects it: `private` (only this class can use it) and `readonly` (can't be
  swapped out later). Now we can use `this.prisma`, `this.jwt`, `this.config`
  anywhere in the class.

## `register` — make a new account

```ts
async register(dto: RegisterDto): Promise<AuthResult> {
  const existing = await this.prisma.user.findUnique({
    where: { email: dto.email },
  });
  if (existing) {
    throw new ConflictException("Email is already registered");
  }

  const passwordHash = await argon2.hash(dto.password);
  const user = await this.prisma.user.create({
    data: {
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
    },
  });

  return this.buildAuthResult(user);
}
```

Step by step:

1. `findUnique({ where: { email } })` — look in the `users` drawer for someone
   with this email. `await` because the database takes a moment.
2. `if (existing) throw new ConflictException(...)` — if that email is taken,
   stop and tell the client "409, already registered." We check first so we get a
   friendly message (the database would also block duplicates thanks to `@unique`,
   but a clear early check is nicer).
3. `argon2.hash(dto.password)` — blend the password into a hash. `await` because
   Argon2 is intentionally slow.
4. `prisma.user.create({ data: {...} })` — save a new user row with the email, the
   **hash** (never the real password), and optional names. We don't set `role`,
   `status`, etc. — remember the schema gives those sensible defaults.
5. `return this.buildAuthResult(user)` — hand back the safe user + fresh tokens
   (so signing up also logs you in). `buildAuthResult` is explained below.

## `login` — let a returning user in

```ts
async login(email: string, password: string): Promise<AuthResult> {
  const user = await this.prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new UnauthorizedException("Invalid credentials");
  }

  const valid = await argon2.verify(user.passwordHash, password);
  if (!valid) {
    throw new UnauthorizedException("Invalid credentials");
  }

  await this.prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return this.buildAuthResult(user);
}
```

1. Find the user by email.
2. `if (!user)` — if there's no such user, say "Invalid credentials." Notice we do
   **not** say "no such email." Telling attackers *which* part was wrong helps them;
   the vague message is on purpose for security.
3. `argon2.verify(user.passwordHash, password)` — blend what they typed and
   compare with the stored hash. Returns true/false.
4. If not valid, same vague "Invalid credentials" error.
5. `user.update(... lastLoginAt: new Date() ...)` — record that they just logged
   in. `new Date()` is "right now."
6. Return safe user + new tokens.

## `refresh` — swap an old pass for a new one (with rotation)

```ts
async refresh(refreshToken: string): Promise<AuthResult> {
  const { id, raw } = this.splitRefreshToken(refreshToken);

  const record = await this.prisma.refreshToken.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!record || record.revokedAt || record.expiresAt.getTime() < Date.now()) {
    throw new UnauthorizedException("Invalid refresh token");
  }

  const matches = await argon2.verify(record.tokenHash, raw);
  if (!matches) {
    throw new UnauthorizedException("Invalid refresh token");
  }

  await this.prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  return this.buildAuthResult(record.user);
}
```

The refresh token we hand out looks like `theId.theSecret` (two parts joined by a
dot). Here's why and how:

1. `splitRefreshToken` chops it back into `id` (which database row) and `raw` (the
   secret part). (Helper explained below.)
2. `findUnique({ where: { id }, include: { user: true } })` — fetch that token row
   **and** the user it belongs to (`include` pulls in the related user too).
3. The big `if` rejects the token if **any** of these is true:
   - `!record` — no such token row.
   - `record.revokedAt` — it was cancelled (logout or already used).
   - `record.expiresAt.getTime() < Date.now()` — it's past its expiry.
     (`getTime()` and `Date.now()` are both "milliseconds since 1970"; comparing
     numbers is easy.)
4. `argon2.verify(record.tokenHash, raw)` — check the secret part matches the
   stored hash. Even if someone guesses an id, they can't fake the secret.
5. `update(... revokedAt: new Date() ...)` — **rotation**: we cancel the token we
   just used. Each refresh token works **once**. If a stolen token is reused, it'll
   already be revoked → rejected. This is a strong safety practice.
6. Return a brand-new access + refresh token pair.

## `logout` — cancel a pass

```ts
async logout(refreshToken: string): Promise<void> {
  const { id } = this.splitRefreshToken(refreshToken);
  await this.prisma.refreshToken.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
```

- `Promise<void>` — this returns nothing useful, just "done." (`void` = "no value.")
- `updateMany({ where: { id, revokedAt: null } })` — stamp `revokedAt` on that
  token *only if* it isn't already revoked. We use `updateMany` because it simply
  does nothing (instead of erroring) if no matching row is found — safe and quiet.

## `findById` — used by the "who am I?" endpoint

```ts
async findById(userId: string): Promise<SafeUser | null> {
  const user = await this.prisma.user.findUnique({ where: { id: userId } });
  return user ? this.sanitize(user) : null;
}
```

- Look up a user by id.
- `user ? this.sanitize(user) : null` — this is a **ternary** (a one-line
  if/else): "if we found a user, return the *safe* version; otherwise return
  `null`." `null` means "nothing here."

## The private helpers (the behind-the-scenes workers)

`private` means these can only be used *inside* this class — they're internal
tools, not part of the public menu.

### `buildAuthResult` — make the tokens and package the answer

```ts
private async buildAuthResult(user: User): Promise<AuthResult> {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = await this.jwt.signAsync(payload, {
    secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
    expiresIn: this.config.get<string>("JWT_ACCESS_TTL", "15m"),
  });

  const refreshToken = await this.createRefreshToken(user.id);

  return { user: this.sanitize(user), accessToken, refreshToken };
}
```

- Build the `payload` (what goes inside the JWT): the user's id, email, role.
- `jwt.signAsync(payload, { secret, expiresIn })` — create and **sign** the access
  token.
  - `secret: this.config.getOrThrow("JWT_ACCESS_SECRET")` — the signing secret,
    read from settings. `getOrThrow` means "if this secret is missing, crash
    loudly now" — we *want* a clear failure rather than insecure tokens.
  - `expiresIn: this.config.get("JWT_ACCESS_TTL", "15m")` — how long it lasts;
    `get(name, "15m")` reads the setting but falls back to `"15m"` if it's not set.
- `createRefreshToken(user.id)` — make the long-lived refresh token (below).
- Return the package: safe user + both tokens.

### `createRefreshToken` — a random, hashed, expiring pass

```ts
private async createRefreshToken(userId: string): Promise<string> {
  const raw = randomBytes(48).toString("base64url");
  const tokenHash = await argon2.hash(raw);
  const ttlMs = this.parseDurationMs(
    this.config.get<string>("JWT_REFRESH_TTL", "30d"),
  );
  const expiresAt = new Date(Date.now() + ttlMs);

  const record = await this.prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt } satisfies Prisma.RefreshTokenUncheckedCreateInput,
  });

  return `${record.id}.${raw}`;
}
```

- `randomBytes(48).toString("base64url")` — make 48 random bytes and turn them
  into safe text. This `raw` secret is essentially impossible to guess.
- `argon2.hash(raw)` — we store only the **hash** of it, never the raw secret
  (same safety rule as passwords).
- `parseDurationMs(config.get("JWT_REFRESH_TTL", "30d"))` — figure out how many
  **milliseconds** "30d" means (helper below).
- `expiresAt = new Date(Date.now() + ttlMs)` — "now plus 30 days."
- `create({ data: { userId, tokenHash, expiresAt } })` — save the token row.
  - `satisfies Prisma.RefreshTokenUncheckedCreateInput` — a TypeScript safety
    check that says "make sure this object matches what Prisma expects to create,"
    catching mistakes while typing.
- `return \`${record.id}.${raw}\`` — hand back `id.secret`. We give the client the
  **raw** secret (only this once); the database only ever holds its hash. The
  `${...}` is **string interpolation** — it drops a value into the text.

### `splitRefreshToken` — chop `id.secret` apart

```ts
private splitRefreshToken(token: string): { id: string; raw: string } {
  const separator = token.indexOf(".");
  if (separator < 0) {
    throw new UnauthorizedException("Malformed refresh token");
  }
  return {
    id: token.slice(0, separator),
    raw: token.slice(separator + 1),
  };
}
```

- `indexOf(".")` — find the position of the dot. Returns `-1` if there's no dot.
- If `< 0` (no dot), the token is malformed → reject.
- `slice(0, separator)` — text *before* the dot = the id.
- `slice(separator + 1)` — text *after* the dot = the secret. (We split on the
  first dot only, which is correct since the id has no dots.)

### `parseDurationMs` — turn "30d" into a number of milliseconds

```ts
private parseDurationMs(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) {
    return 30 * 24 * 60 * 60 * 1000; // default 30 days
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const unitMs: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return amount * unitMs[unit];
}
```

- `/^(\d+)([smhd])$/` is a **regular expression** (regex) — a pattern matcher. In
  plain words: "some digits, then one of the letters s, m, h, or d, and nothing
  else." So it matches `"30d"`, `"15m"`, `"3600s"`.
  - `\d+` = one or more digits; `(...)` captures that part to read later.
  - `[smhd]` = exactly one of those four letters.
  - `^...$` = the whole text must match (no leftovers).
- `.exec(value.trim())` — run the pattern (after `trim()` removes stray spaces).
- If it doesn't match, we safely default to 30 days.
- `Number(match[1])` — the digits become a real number (the amount).
- `unitMs` — a lookup table: how many milliseconds each unit is worth.
- `amount * unitMs[unit]` — e.g. `30 * 86,400,000 ms = 30 days`.

> **Why write our own tiny parser?** It's just a few lines and avoids adding
> another borrowed tool for something this small. (Libraries like `ms` exist; for
> one function, our own is simpler.)

### `sanitize` — hide the password hash before sending

```ts
private sanitize(user: User): SafeUser {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}
```

- This uses **destructuring with rest**: pull `passwordHash` out into a variable
  named `_passwordHash`, and gather **everything else** into `safe` (the `...` is
  the "rest" — all remaining fields).
- We return `safe` — the user *without* the password hash. So no endpoint can
  accidentally leak it.
- The `_` in front of `_passwordHash` tells our code-checker "yes, this variable
  is unused on purpose" (we only pulled it out to drop it).

## Recap

- **Passwords are hashed** with Argon2 and never stored or returned in plain form.
- Login gives an **access token** (short JWT wristband) + a **refresh token**
  (long, hashed, single-use stub).
- **Refresh rotates**: each refresh token works once, then is revoked — stolen
  tokens become useless.
- Errors are deliberately **vague** ("Invalid credentials") to avoid helping
  attackers.
- Helper functions keep the main steps clean, and `sanitize` makes sure we never
  send the password hash out.

Next: the doors (routes), the bouncer (guard), and switching the app on →
[07-guard-controller-and-startup.md](07-guard-controller-and-startup.md)
