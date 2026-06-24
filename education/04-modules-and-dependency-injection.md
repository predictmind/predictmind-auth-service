# 4. Modules & Dependency Injection (how parts find each other)

Our app is made of many small parts. This file explains how Nest lets them find
and use each other without us wiring everything by hand. Two big ideas:
**decorators** and **dependency injection**. They sound fancy; they're friendly.

## Decorators — sticky labels for code

A **decorator** is a label that starts with `@` and sits on top of a class or
function to give it a special power. Example:

```ts
@Injectable()
export class PrismaService { ... }
```

`@Injectable()` is a sticky note that says: "Nest, you're allowed to create this
and hand it to anyone who needs it." You don't call it yourself — Nest reads the
label and does the work. Think of decorators as **stickers** that tell Nest how
to treat a piece of code.

## Dependency Injection (DI) — "ask, don't build"

Imagine you need a pencil to do your homework. Two ways:

1. **Build it yourself:** chop wood, mine graphite... exhausting and you might do
   it wrong.
2. **Ask for one:** "Please give me a pencil." Someone hands you a ready one.

**Dependency Injection** is option 2 for code. Instead of a class building the
tools it needs, it just *asks* for them, and Nest hands over ready-made ones.

A "dependency" is just "a thing this code needs to do its job." Our auth code
*needs* the database helper, the token maker, and the settings reader. It asks
for them like this (you'll see this exact pattern in file 6):

```ts
constructor(
  private readonly prisma: PrismaService,   // "give me the database helper"
  private readonly jwt: JwtService,         // "give me the token maker"
  private readonly config: ConfigService,   // "give me the settings reader"
) {}
```

A `constructor` is the special function that runs when a class is first created.
By listing those tools as parameters, we're saying "I need these" — and Nest
**injects** (hands in) the right ones automatically.

> **Why do it this way instead of building tools inside the class?** Two reasons:
> (1) We can give the class a *fake* database during tests, so we can test it
> without a real database. (2) Everyone shares one database helper instead of
> each part making its own — tidier and faster. This is a core reason Nest apps
> stay maintainable as they grow.

## `PrismaService` — our database helper, the Nest way

File: `src/prisma/prisma.service.ts`

```ts
import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

Line by line:

- `import { ... } from "@nestjs/common";` — borrow tools from Nest. `import` means
  "bring this in from another file/package so I can use it here."
- `import { PrismaClient } from "@prisma/client";` — bring in the database client
  that Prisma generated for us (from our schema in file 3).
- `@Injectable()` — the sticker: "Nest, you can manage and share this."
- `export class PrismaService` — `export` means "let other files use this."
  `class` is a blueprint for an object that bundles data + actions.
- `extends PrismaClient` — **inherit** all the powers of Prisma's client. So our
  `PrismaService` *is* a Prisma client (it can do `.user.findUnique(...)`), plus
  the extra Nest behavior we add. `extends` = "start with everything that has,
  then add more."
- `implements OnModuleInit, OnModuleDestroy` — a promise that this class provides
  two special functions Nest will call at the right moments. `implements` = "I
  promise to include these functions."
- `async onModuleInit()` — Nest calls this **when the app starts**. We
  `$connect()` to open the database connection then. `async`/`await` is how we
  wait for slow things (like talking to a database) without freezing the program
  (more on this in file 6).
- `async onModuleDestroy()` — Nest calls this **when the app shuts down**. We
  `$disconnect()` to close the database connection neatly, like turning off the
  lights when you leave.

> **Why connect/disconnect here?** Opening and closing the database at the right
> times avoids leaks (connections left dangling) and makes shutdowns clean.

## `PrismaModule` — making the helper available everywhere

File: `src/prisma/prisma.module.ts`

```ts
import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

A **module** is a labeled box that groups related parts and decides what's shared.

- `@Module({ ... })` — the sticker that turns this class into a module.
- `providers: [PrismaService]` — "this module *owns/creates* the PrismaService."
  A **provider** is something Nest can create and inject (usually a service).
- `exports: [PrismaService]` — "other modules are allowed to use it too." If we
  didn't export it, it'd be private to this box.
- `@Global()` — "make this available to the **whole** app without each module
  importing it." We mark Prisma global because almost everything needs the
  database, so it's convenient.

> **Is `@Global()` always good?** No — making everything global gets messy. We use
> it only for truly app-wide things like the database. Most modules should be
> imported explicitly so it's clear who uses what.

## How a "module" connects to the whole app

In file 7 you'll see `app.module.ts` lists `PrismaModule` and `AuthModule` in its
`imports`. That's how Nest knows these boxes exist and wires everything together
when the app boots.

## Recap

- **Decorators** (`@Injectable`, `@Module`, ...) are stickers that give code
  special powers Nest understands.
- **Dependency Injection** = a class *asks* for the tools it needs in its
  `constructor`, and Nest hands them over (great for sharing and testing).
- `PrismaService` is our shared database helper; `PrismaModule` (marked
  `@Global`) makes it available everywhere.

Next: checking that incoming data is safe →
[05-validation-and-dtos.md](05-validation-and-dtos.md)
