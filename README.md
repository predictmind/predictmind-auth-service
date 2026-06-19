# predictmind-auth-service

PredictMind **auth** microservice — authentication, users and RBAC.

Part of the PredictMind platform (microservices architecture). Product and architecture documentation lives in the private [`predictmind/app`](https://github.com/predictmind/app) repository.

## Tech stack

- NestJS + TypeScript
- **Prisma** ORM → PostgreSQL (portable `DATABASE_URL`)
- JWT access + rotating refresh tokens (`@nestjs/jwt`)
- Argon2id password hashing
- Default port: `3002` (overridable via `PORT`), routed by the gateway under `/api/v1/auth` and `/api/v1/users`

## Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/register` | — | Create an account (auto-login) |
| POST | `/api/v1/auth/login` | — | Email + password → token pair |
| POST | `/api/v1/auth/refresh` | — | Rotate refresh token → new pair |
| POST | `/api/v1/auth/logout` | — | Revoke a refresh token |
| GET | `/api/v1/auth/me` | Bearer | Current user profile |
| GET | `/api/v1/health` | — | Health check |

Access tokens are short-lived (default 15m). Refresh tokens are opaque, stored **hashed** (Argon2), single-use (rotated on refresh), and revocable.

## Getting started

```bash
cp .env.example .env          # set DATABASE_URL + JWT secrets
npm install                   # also runs `prisma generate`
npm run prisma:migrate        # create tables (needs a running Postgres)
npm run start:dev
```

A local Postgres is available via the platform stack in `predictmind-infra` (`docker compose up postgres`).

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run start:dev` | Watch mode |
| `npm run build` | Compile to `dist/` |
| `npm test` | Unit tests |
| `npm run lint` | ESLint |
| `npm run prisma:migrate` | Create/apply a dev migration |
| `npm run prisma:deploy` | Apply migrations (CI/CD / prod) |

## Configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string (any provider) |
| `JWT_ACCESS_SECRET` / `JWT_ACCESS_TTL` | Access token signing + lifetime |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_TTL` | Refresh token lifetime |
| `PORT` | Listen port (default 3002) |

## License

Proprietary — © PredictMind. All rights reserved.
