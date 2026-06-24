# 5. Validation & DTOs (checking the data people send)

**Never trust data from the outside world.** People (and hackers) can send
anything — empty fields, giant text, the wrong type, sneaky extra fields. Before
we use incoming data, we check it. This file is about how.

## What is a DTO?

**DTO** stands for *Data Transfer Object*. Big words, simple thing: a DTO is a
small class that describes **the shape of the data we expect** for one request,
plus the rules each field must follow. It's like a **fill-in form with rules**:
"Email box: must be a real email. Password box: at least 12 letters."

## The Register form: `src/auth/dto/register.dto.ts`

```ts
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(12, { message: "Password must be at least 12 characters" })
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;
}
```

Line by line:

- `import { ... } from "class-validator";` — borrow the rule-stickers from a tool
  called **class-validator**. Each sticker checks one thing.
- `export class RegisterDto` — our form blueprint for sign-up.
- `@IsEmail()` on `email` — the value must look like a real email
  (`name@place.com`), or the request is rejected.
- `email!: string;` — `email` is text. The `!` tells TypeScript "trust me, this
  will be filled in" (the validator guarantees it). Without `!`, strict mode would
  complain it might be empty.
- `password` has **three** stickers stacked:
  - `@IsString()` — must be text.
  - `@MinLength(12, ...)` — at least 12 characters. The `message` is the friendly
    error we show if it's too short.
  - `@MaxLength(128)` — no longer than 128, so nobody sends a novel to slow us
    down.
- `firstName?` and `lastName?`:
  - `@IsOptional()` — it's okay to leave these out.
  - The `?` after the name also marks it optional in TypeScript.
  - `@IsString()` + `@MaxLength(80)` — but *if* given, it must be text and not
    too long.

> **Why a 12-character minimum?** Short passwords are easy to guess or crack.
> Longer is much safer. (Our security doc requires strong passwords.)

## The Login form: `src/auth/dto/login.dto.ts`

```ts
import { IsEmail, IsString, MaxLength } from "class-validator";

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(128)
  password!: string;
}
```

Simpler: to log in you only need a valid `email` and a `password` that's text and
not absurdly long. We **don't** check the 12-char minimum here — old accounts or
rules might differ, and we just need to compare what they typed against what's
stored.

## The Refresh form: `src/auth/dto/refresh.dto.ts`

```ts
import { IsString } from "class-validator";

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}
```

To get a fresh pass, the client sends back the long refresh token text. We just
require it to be a string.

## Who actually runs these checks? The ValidationPipe

Writing rules isn't enough — something must *enforce* them. In `main.ts`
(file 7) we switch on a **global ValidationPipe**:

```ts
app.useGlobalPipes(
  new ValidationPipe({ whitelist: true, transform: true }),
);
```

A **pipe** in Nest is a checkpoint that data passes through *before* it reaches
our code. The `ValidationPipe`:

- reads the DTO stickers and **rejects** bad requests automatically with a clear
  error (we don't write a single `if` ourselves), and
- `whitelist: true` — **strips out any extra fields** the client sneaks in that
  aren't in our DTO. If someone sends `{ email, password, isAdmin: true }`, the
  sneaky `isAdmin` is thrown away. Great for safety.
- `transform: true` — converts the raw JSON into a real instance of our DTO class
  (and fixes simple types), so our code gets a tidy, typed object.

> **Why a *global* pipe instead of checking in each function?** One switch covers
> every endpoint, so we can't forget to validate somewhere. Less code, fewer
> holes.

## The flow, start to finish

```text
Client sends JSON  ─▶  ValidationPipe checks it against the DTO
                         │
              bad ◀──────┤────────▶ good
        (auto 400 error) │         (clean, typed object handed to our code)
```

`400` is the HTTP status code for "Bad Request" — the polite way to say "you sent
something wrong."

## Recap

- A **DTO** describes the expected shape + rules of incoming data.
- **class-validator** stickers (`@IsEmail`, `@MinLength`, `@IsOptional`...) define
  the rules.
- The global **ValidationPipe** enforces them, strips unknown fields
  (`whitelist`), and hands our code clean data (`transform`).
- Golden rule: **never trust outside data without validating it.**

Next: the heart of the service — signup, login, passwords, tokens →
[06-the-auth-brain.md](06-the-auth-brain.md)
