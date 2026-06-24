# 2. The Project & Config Files

Every project has some "setup" files that don't *do* the main job but tell the
computer and the tools how everything should work. Let's meet them.

## `package.json` — the project's ID card and shopping list

This is the most important setup file. It does three jobs:

```json
{
  "name": "predictmind-auth-service",
  "version": "0.1.0",
  "private": true,
  "description": "PredictMind auth service - authentication, users and RBAC.",
  ...
}
```

- `name`, `version`, `description` — the project's **ID card** (what it's called).
- `"private": true` — "never accidentally publish this to the internet's public
  package store." A safety lock.

### Scripts — buttons you can press

```json
"scripts": {
  "build": "nest build",
  "start:dev": "nest start --watch",
  "lint": "eslint \"{src,test}/**/*.ts\"",
  "test": "jest",
  "prisma:generate": "prisma generate",
  "postinstall": "prisma generate"
}
```

A **script** is a nickname for a longer command. Instead of typing the long
command, you type `npm run build` and it runs `nest build`. The ones we use:

- `build` — turn our TypeScript into plain JavaScript the computer can run.
- `start:dev` — run the app and **watch** for changes (auto-restart while coding).
- `lint` — check our code for messy or risky bits (the spell-checker for code).
- `test` — run our automatic checks to make sure things work.
- `prisma:generate` — build the database helper code (more on this later).
- `postinstall` — a **magic-name** script: npm runs it automatically right after
  installing. We use it so the database helper is always ready.

### Dependencies — the shopping list

```json
"dependencies": {
  "@nestjs/common": "^10.4.0",
  "@prisma/client": "^6.1.0",
  "argon2": "^0.41.1",
  ...
},
"devDependencies": {
  "prisma": "^6.1.0",
  "eslint": "^9.17.0",
  ...
}
```

These are tools other people wrote that we **borrow** instead of writing
ourselves. `npm install` reads this list and downloads them into a folder called
`node_modules`.

- **dependencies** = tools we need *while the app is running* (e.g. `argon2` to
  scramble passwords).
- **devDependencies** = tools we only need *while building/coding* (e.g. `eslint`
  the code checker). The real running app doesn't need these, so we keep them
  separate to stay lean.

The `^10.4.0` means "version 10.4.0 **or any newer 10.x**." The `^` (caret) lets
us get small safe updates automatically but never a big version jump that might
break things.

> **Why borrow tools at all?** Writing your own password-scrambler or web-token
> maker is hard and easy to get dangerously wrong. Using well-tested tools that
> thousands of people rely on is safer than rolling your own.

## `package-lock.json` — the exact receipt

`package.json` says "version 10.x is fine." `package-lock.json` writes down the
**exact** versions that actually got installed, like a detailed receipt. This way
every computer and every teammate installs *exactly* the same thing. You don't
edit this file by hand — npm manages it.

## `tsconfig.json` — TypeScript's rule book

This tells TypeScript how strict to be and how to turn our code into JavaScript.
A few important lines:

```json
"strict": true,             // turn on all the safety checks (recommended!)
"target": "ES2022",         // which version of JavaScript to produce
"experimentalDecorators": true,  // allow the @decorator style Nest uses
"outDir": "./dist"          // put the built JavaScript in a folder called dist
```

> **Why `strict: true`?** It forces us to handle tricky cases (like "what if this
> is empty?"). More typing now, far fewer bugs later.

## `nest-cli.json` — Nest's little settings

A tiny file telling Nest where our code lives (`src`) and to clean the output
folder before each build. Nothing scary.

## `eslint.config.mjs` — the code "spell-checker"

**ESLint** reads our code and complains about messy or risky patterns (unused
variables, dangerous shortcuts). Our config turns on sensible defaults plus one
custom rule: "if a variable's name starts with `_`, it's on purpose, don't
complain." We use that trick when we have to name something but don't use it.

## `.prettierrc` — the auto-formatter

**Prettier** makes all our code *look* the same (spaces, quotes, line breaks) so
the whole team's code is tidy and consistent. You don't argue about style; you
just run Prettier and it fixes the spacing for you.

## `.env.example` — the secret-settings template

```bash
DATABASE_URL=postgresql://predictmind:predictmind@localhost:5432/predictmind?schema=auth
JWT_ACCESS_SECRET=dev-access-secret-change-me
PORT=3002
```

Some settings are **secrets** (like database passwords and token secrets) and
must **never** be written inside the code or saved to GitHub. Instead they live
in a file called `.env` that stays on your machine only. `.env.example` is a
*template* showing which settings exist, with fake values, so a new teammate
knows what to fill in.

> **Why keep secrets out of code?** If a secret is in the code and the code is
> public, the whole internet can see your password. Bad! Environment variables
> keep secrets separate from code, so we can also use different values for our
> laptop vs. the real live server.

## `.github/` — robots that help us

Inside `.github/` are instructions for GitHub's helper robots:

- `workflows/ci.yml` — **CI** ("Continuous Integration"). Every time we push code,
  GitHub automatically runs `lint`, `test`, and `build` to check we didn't break
  anything. Like a teacher auto-marking your homework the moment you hand it in.
- `workflows/codeql.yml` — a security robot that scans for dangerous bugs.
- `dependabot.yml` — a robot that watches our borrowed tools and opens a request
  when a newer/safer version comes out.

## `Dockerfile` — the lunchbox recipe

Explained fully in [file 8](08-docker-and-running-it.md). Short version: it's a
recipe to pack our app + everything it needs into one neat box that runs the
same on any computer.

## Recap

These files don't do the "auth" job themselves — they **set the stage**:
what tools to download (`package.json`), how strict to be (`tsconfig`), how to
stay tidy (eslint, prettier), where secrets go (`.env`), and which robots help
(`.github`).

Next: how we store users in a database →
[03-database-and-prisma.md](03-database-and-prisma.md)
