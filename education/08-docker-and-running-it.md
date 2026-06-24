# 8. Docker & Running It Anywhere

Our app needs specific things to run: the right Node.js version, our tools, the
built code. **Docker** lets us pack all of that into one sealed box (an **image**)
that runs the same on your laptop, a teammate's computer, or a giant cloud server.

## Why Docker? (the lunchbox analogy)

"It works on my machine" is a famous programmer headache — code runs for one
person but breaks for another because their computers differ. Docker fixes this by
packing the app **and its whole environment** into a lunchbox. Everyone heats the
*same* lunchbox, so it tastes the same everywhere.

- An **image** = the recipe + ingredients, frozen into a package.
- A **container** = a running copy of that image (you can run many at once).

## Reading the `Dockerfile` line by line

A `Dockerfile` is the recipe for building the image. Ours uses **two stages** (a
"multi-stage build") — a big messy kitchen to cook, then a small clean plate to
serve. This keeps the final image small and tidy.

### Stage 1 — the builder (the messy kitchen)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm install
COPY . .
RUN npm run build
```

- `FROM node:20-alpine AS builder` — start from a ready-made mini-Linux that has
  Node.js 20. `alpine` is a *tiny* version of Linux (small = faster, safer). `AS
  builder` names this stage so we can refer to it later.
- `WORKDIR /app` — work inside a folder called `/app` (like "cd into this folder").
- `COPY package*.json ./` — copy just the shopping lists first. (Copying these
  *before* the rest is a speed trick: Docker reuses cached results if these didn't
  change.)
- `COPY prisma ./prisma` — copy the database schema, needed by the next step.
- `RUN npm install` — download all tools. This also runs our `postinstall` →
  `prisma generate`, so the database client is ready.
- `COPY . .` — now copy the rest of our code in.
- `RUN npm run build` — compile TypeScript → JavaScript into `dist/`.

### Stage 2 — the runner (the clean serving plate)

```dockerfile
FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm install --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
EXPOSE 3002
USER node
CMD ["node", "dist/main.js"]
```

- `FROM node:20-alpine AS runner` — a fresh, clean mini-Linux for the final image
  (none of the builder's mess comes along).
- `ENV NODE_ENV=production` — tell Node "this is the real deal, run in fast/safe
  production mode."
- `COPY package*.json ./` and `COPY prisma ./prisma` — bring the lists and schema.
- `RUN npm install --omit=dev --ignore-scripts && npm cache clean --force`
  - `--omit=dev` — install only the *runtime* tools, skip the coding-only ones
    (smaller image).
  - `--ignore-scripts` — don't run `postinstall` here (we'll copy the already-built
    Prisma client instead, which is faster and avoids needing extra tools).
  - `npm cache clean --force` — delete the download cache to shrink the image.
- `COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma` — copy the
  generated Prisma client *from the builder stage* into our clean image.
- `COPY --from=builder /app/dist ./dist` — copy the compiled app from the builder.
- `EXPOSE 3002` — note "this app listens on port 3002" (documentation + helps
  tooling).
- `USER node` — run as the limited `node` user, **not** the all-powerful `root`.
  If the app is ever hacked, the attacker has fewer powers. Important safety habit.
- `CMD ["node", "dist/main.js"]` — the command to actually start the app when the
  container runs.

Below that, a comment reminds us:

```dockerfile
# Migrations run as a separate deploy step (CI/CD or an init job), not per replica:
#   npx prisma migrate deploy
```

> **Why not run database migrations inside this container's start command?** If we
> run 5 copies (replicas) of the service, we don't want 5 of them all trying to
> change the database at once. So migrations are run **once** as a separate deploy
> step. Cleaner and safer.

## `.dockerignore` — what to leave out of the lunchbox

Just like `.gitignore`, `.dockerignore` lists things to **not** copy into the
image: `node_modules` (we reinstall fresh), `.git`, logs, `.env` secrets. Smaller,
safer images.

## How to actually run it (recipes)

**Just the code, on your machine (for coding):**

```bash
cp .env.example .env        # create your settings file and fill it in
npm install                 # download tools (+ generate Prisma client)
npm run prisma:migrate      # build the database tables (needs Postgres running)
npm run start:dev           # start the server, auto-restart on changes
```

**Everything together (database + all services) with Docker Compose** — from the
`predictmind-infra` repo:

```bash
docker compose up --build
```

This starts PostgreSQL, Redis, and all the services together, wired up. Great for
seeing the whole platform run at once. (Docker Compose is like a recipe that
cooks *several* lunchboxes and connects them.)

## Recap

- **Docker** packs the app + its environment into an **image** so it runs the
  same everywhere; a running copy is a **container**.
- Our **multi-stage** Dockerfile builds in a messy stage, then copies only the
  results into a tiny clean final image.
- We run as the non-root `node` user, keep migrations as a separate step, and use
  `.dockerignore` to keep the image lean.

Next: the dictionary of tricky words →
[09-glossary.md](09-glossary.md)
