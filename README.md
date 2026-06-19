# predictmind-auth-service

PredictMind **auth** microservice - Authentication, users and RBAC.

Part of the PredictMind platform (microservices architecture). Product and
architecture documentation lives in the private
[`predictmind/app`](https://github.com/predictmind/app) repository.

## Tech stack

- NestJS + TypeScript
- Default port: `3002` (overridable via `PORT`)
- Routed through the API gateway under `/api/v1/auth`

## Getting started

```bash
npm install
npm run start:dev
```

Health check: `GET /api/v1/health`.

## Docker

```bash
docker build -t predictmind-auth-service .
docker run -p 3002:3002 predictmind-auth-service
```

## Quality & security

CI (lint + test + build), CodeQL code scanning, and Dependabot run on every push and PR.

## License

Proprietary - (c) PredictMind. All rights reserved.