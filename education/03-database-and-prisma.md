# 3. The Database & Prisma

This is where we remember users forever. Let's learn the tools, then read our
database file line by line.

## What is an ORM? (and why Prisma)

Talking to a database normally means writing **SQL**, a special language:

```sql
SELECT * FROM users WHERE email = 'trader@example.com';
```

That works, but mixing SQL strings into our TypeScript is easy to get wrong and
hard to keep safe. So we use an **ORM** (Object-Relational Mapper). An ORM is a
**translator**: we write normal TypeScript like `prisma.user.findUnique(...)`
and the ORM turns it into the correct SQL for us.

We use **Prisma**. With Prisma we describe our data in one tidy file
(`schema.prisma`), and Prisma:
1. creates the database tables for us (called **migrations**), and
2. generates a TypeScript helper (the **Prisma Client**) that knows every field,
   so autocomplete works and typos get caught.

> **Why Prisma over the alternative (TypeORM)?** Prisma's single schema file is
> easy to read, its migrations are reliable, and its type-safety is the best —
> if you misspell a field, your editor warns you instantly. (We discussed this
> trade-off with the team and picked Prisma on purpose.)
>
> **The one catch:** for huge time-series number-crunching (like price history),
> we'll sometimes write raw SQL by hand for speed. That's normal and Prisma
> allows it. For user accounts, Prisma is perfect.

## Reading `prisma/schema.prisma` line by line

### The generator

```prisma
generator client {
  provider = "prisma-client-js"
}
```

This says: "Prisma, please **generate** a JavaScript/TypeScript client so my code
can talk to the database." Running `prisma generate` reads this and builds that
helper into `node_modules`. Without it, our code wouldn't know how to call the DB.

### The datasource

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

- `provider = "postgresql"` — we're using a PostgreSQL database.
- `url = env("DATABASE_URL")` — **don't** hard-code the address+password here;
  read it from the secret environment variable `DATABASE_URL`. This is the
  "keep secrets out of code" rule again, and it's also what makes us
  **portable**: to switch from a local database to a cloud one, we only change
  that one environment variable — no code changes.

### Enums — a fixed list of allowed choices

```prisma
enum UserRole {
  USER
  PREMIUM
  ADMIN
  SUPER_ADMIN
}

enum UserStatus {
  ACTIVE
  SUSPENDED
  PENDING
}
```

An **enum** ("ee-num") is a list of the *only* allowed values for a field. A
user's `role` can only be one of those four words — never "banana." This stops
bad data from sneaking in.

- `UserRole` decides *what a user is allowed to do* (a normal `USER`, a paying
  `PREMIUM`, an `ADMIN`, or the top `SUPER_ADMIN`).
- `UserStatus` decides *the state of the account* (`ACTIVE` = normal,
  `SUSPENDED` = blocked, `PENDING` = not finished signing up).

### The User model — one drawer in the cabinet

A **model** describes one type of thing we store. `User` is one person's record.

```prisma
model User {
  id            String         @id @default(uuid()) @db.Uuid
  email         String         @unique
  passwordHash  String
  role          UserRole       @default(USER)
  status        UserStatus     @default(ACTIVE)
  emailVerified Boolean        @default(false)
  firstName     String?
  lastName      String?
  lastLoginAt   DateTime?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  refreshTokens RefreshToken[]

  @@map("users")
}
```

Let's go field by field. Each field is `name  Type  @attributes`.

- `id String @id @default(uuid()) @db.Uuid`
  - `id` — a unique label for this user, like a library card number.
  - `String` — it's text.
  - `@id` — this is the **primary key** (the one field that is always unique and
    identifies the row).
  - `@default(uuid())` — if we don't provide one, auto-make a **UUID**: a long
    random unique code like `9f1c...`. We use random IDs instead of `1, 2, 3...`
    so people can't guess how many users we have or peek at someone else's record
    by changing a number.
  - `@db.Uuid` — store it using Postgres's special compact UUID type.

- `email String @unique`
  - Text, and `@unique` means **no two users can have the same email**. The
    database itself enforces this — a strong guarantee.

- `passwordHash String`
  - We store the **scrambled** password, never the real one (see file 6). The
    name says "hash" to remind everyone it's scrambled, not the plain password.

- `role UserRole @default(USER)`
  - Uses our enum. New users start as a normal `USER`.

- `status UserStatus @default(ACTIVE)`
  - New users start `ACTIVE`.

- `emailVerified Boolean @default(false)`
  - `Boolean` is a true/false switch. New users haven't confirmed their email
    yet, so it starts `false`.

- `firstName String?` and `lastName String?`
  - The `?` means **optional** — the user might not give a name. Without the `?`,
    TypeScript and the database would *require* it.

- `lastLoginAt DateTime?`
  - When they last logged in. Optional because a brand-new user hasn't logged in
    yet.

- `createdAt DateTime @default(now())`
  - A timestamp set to the current time automatically when the row is created.

- `updatedAt DateTime @updatedAt`
  - `@updatedAt` makes Prisma automatically refresh this timestamp every time the
    row changes. Great for knowing when something was last touched.

- `refreshTokens RefreshToken[]`
  - This is a **relation**: one user can have many refresh tokens (the `[]` means
    "a list"). It links the `User` to the `RefreshToken` model below. There's no
    real column for this; it's how Prisma lets us hop from a user to their tokens.

- `@@map("users")`
  - By default Prisma would name the table `User`. `@@map` renames the actual
    database table to `users` (lowercase, plural) — a common, tidy convention.

### The RefreshToken model — remembering "keep me logged in" passes

```prisma
model RefreshToken {
  id        String    @id @default(uuid()) @db.Uuid
  userId    String    @db.Uuid
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
  @@map("refresh_tokens")
}
```

- `userId String @db.Uuid` — which user this token belongs to (stores their `id`).
- `user User @relation(fields: [userId], references: [id], onDelete: Cascade)`
  - Connects this token to a `User`. `fields: [userId]` (the column here) points
    to `references: [id]` (the User's id).
  - `onDelete: Cascade` — if a user is deleted, automatically delete all their
    tokens too (so we don't leave orphan passes lying around).
- `tokenHash String` — again we store a **scrambled** version of the token, not
  the real token. If someone stole our database, the tokens inside would be
  useless to them.
- `expiresAt DateTime` — when this pass stops working.
- `revokedAt DateTime?` — if we cancel a pass early (logout), we stamp the time
  here. Empty (`null`) means "still valid."
- `@@index([userId])` — an **index** is like the alphabetical tabs in a phone
  book; it makes "find all tokens for this user" super fast.
- `@@map("refresh_tokens")` — name the table `refresh_tokens`.

## Migrations — actually building the tables

The schema file is just a *description*. To create the real tables in the
database we run:

```bash
npm run prisma:migrate     # while developing (creates a migration file)
npm run prisma:deploy      # on the real server (applies existing migrations)
```

A **migration** is a saved set of database changes, like a numbered diary entry
("entry 1: created the users and refresh_tokens tables"). Saving them means every
environment (your laptop, the test server, the live server) can be brought to the
exact same shape, step by step.

## Recap

- An **ORM** translates our TypeScript into database language; ours is **Prisma**.
- `schema.prisma` describes our data: **models** (User, RefreshToken) made of
  **fields** with **attributes** (`@id`, `@unique`, `@default`, relations).
- We store **scrambled** passwords and tokens, random **UUID** ids, and use
  **migrations** to build the tables safely.

Next: how the app's parts find each other →
[04-modules-and-dependency-injection.md](04-modules-and-dependency-injection.md)
