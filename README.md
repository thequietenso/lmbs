# Bibliotech LMBS

Library management application with a NestJS/PostgreSQL API and React frontend, maintained in an npm-workspaces monorepo.

> **Review branch:** `feat/complete-lmbs-monorepo`. Core implementation, local API/database/browser acceptance and review fixes are complete. See [verification evidence and limits](docs/verification.md). No hosted deployment or hosted database migration is claimed.

## Features

- Public catalog/genre browsing; authenticated staff management and patron-scoped account/review endpoints.
- Transactional borrowing, returns that restore inventory only once, renewal rules, UTC-day fines, soft deletion and server-generated audit history.
- Durable optional creation idempotency, optimistic book updates, validated/paginated API, statistics and real database health checks.
- Login/register/logout, role checks, explicit local demo versus authoritative connected mode, and authenticated Socket.IO invalidation.
- Local PostgreSQL/Compose deployment, shared API contracts and automated unit/database/client checks.

## Preview

Actual Nginx-served application connected to a disposable PostgreSQL database, filtered to Software Engineering. The displayed classroom administrator is a synthetic test identity.

![Bibliotech connected catalog at a 1440×1000 CSS viewport, DPR 1](docs/images/app-preview.png)

[Full-page mobile capture — 390×844 CSS viewport, DPR 1](docs/images/mobile-preview.png)

## Project layout

```text
lmbs/
├── apps/api/                 # NestJS backend, Prisma migrations and tests
├── apps/web/                 # React/Vite frontend
├── packages/shared/          # Shared TypeScript API contracts
├── tests/                    # Workspace checks and opt-in real API smoke test
├── deployment/               # Nginx proxy configuration
├── compose.yaml              # Local PostgreSQL, migrations, API and frontend
├── Dockerfile                # API and web build targets
├── spec.md                   # Architecture and API contract
└── Installation_Guide.md     # Setup and classroom walkthrough
```

This repository continues the original backend Git history. The neutral `lmbs` name reflects the complete application; the backend remains isolated in `apps/api`. Generated clients, dependencies, secrets and backups are not published.

## Documentation

- [Installation and classroom walkthrough](Installation_Guide.md)
- [Backend features, configuration and API reference](apps/api/README.md)
- [Frontend usage](apps/web/README.md)
- [Architecture, invariants and scope](spec.md)
- [Approved migration design](docs/superpowers/specs/2026-11-14-lmbs-monorepo-design.md)

## Native development

Use Node.js 24 LTS and npm. From the repository root:

```bash
npm ci
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env: your DATABASE_URL, JWT_SECRET and frontend origin.
npm run db:generate
npm run db:deploy
# Optional, against your own development database only:
SEED_DEMO_DATA=true npm run db:seed
npm run dev
```

API: `http://localhost:3001/api/v1`. Frontend: `http://localhost:5173`.

`db:deploy` applies committed migrations. `db:migrate` is for developing new migrations, not automatically modifying shared/hosted databases. Keep Supabase settings private in `apps/api/.env`.

## Quality checks

```bash
npm run test:workspace
npm run build
npm run lint
npm test
# Use only a separate disposable test database:
TEST_DATABASE_URL="postgresql://test:test@localhost:5432/lmbs_test" npm run test:e2e
```

See the backend README for test database setup. Unit tests, real PostgreSQL integration, browser acceptance and container deployment are separate checks.

## Local containers

```bash
cp .env.example .env
# Replace both placeholder secrets; use a URL-safe database password.
docker compose up --build
```

Frontend: `http://localhost:8080`. Browser API traffic uses the same-origin `/api/v1` proxy. PostgreSQL binds to loopback port 54329. The containerized API is not exposed directly; use `http://localhost:8080/api/v1` through Nginx. Native development still uses port 3001. Committed migrations run before API startup. Seeding/admin bootstrap is explicit, not automatic.

Do not run `docker compose down -v` on a database you need to retain: it removes its volume. This is a local deployment configuration, not a claim of production hardening.

## Scope

Catalog, members, circulation, reviews, activities, statistics, authentication and real-time notifications are the core completion target. Demo and API modes remain distinct. Full-text search/tagging, backend report exports and mobile apps are future work.

## Ownership and license

Maintained by [@thequietenso](https://github.com/thequietenso). This continues the Bibliotech/PLP educational project. The API declares `UNLICENSED`; public visibility is not an open-source license grant. Third-party dependencies/assets retain their terms.
