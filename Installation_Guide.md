# Bibliotech LMBS — Installation and Classroom Guide

This guide explains how the backend was extended and how to reproduce the full application. Commands start at the **monorepo root** unless a section explicitly changes directory. Do not scaffold a second Nest application over this checkout.

Commands use a POSIX shell (Linux/macOS/WSL/Git Bash). In PowerShell, set environment variables with `$env:NAME="value"`; do not paste POSIX inline environment assignments unchanged.

## 1. Understand the selected structure

```text
lmbs/
├── package.json / package-lock.json  # One workspace dependency graph
├── apps/api/                        # Nest application
│   ├── prisma/schema.prisma         # Database models
│   ├── prisma/migrations/           # Committed SQL history
│   ├── prisma/seed.ts               # Repeatable development data
│   ├── prisma7.config.ts            # Prisma CLI configuration
│   ├── src/                         # Controllers/services/DTOs/guards
│   ├── test/                        # HTTP/database tests
│   └── .env.example                 # API environment template
├── apps/web/                        # React/Vite application
├── packages/shared/src/index.ts     # API response/identity types
├── tests/                           # Workspace and runtime acceptance
└── deployment/                      # Nginx proxy configuration
```

**Teaching checkpoint:** npm workspaces are not Nest's multi-application CLI mode. Each application keeps its own framework configuration; the root orchestrates package installation and commands. A package named `lmbs-ui` may live at `apps/web`: package names and directory names need not match.

The earlier backend-only Git history is preserved. Renaming the GitHub repository and moving tracked paths does not require a new history or force push. The original frontend was imported as normal files, not as a nested Git repository or submodule.

## 2. Prerequisites

- Node.js **24 LTS** recommended; the root engine floor is 22.12.0. Use a version manager or the official Node installer appropriate to your operating system.
- npm, Git, and a PostgreSQL database. PostgreSQL 17 is used for local integration verification.
- Docker Compose is optional for containerized development.
- Supabase is an optional hosted PostgreSQL provider, not a mandatory dependency for teaching/testing.

```bash
node --version
npm --version
git --version
```

Do not install a global Nest CLI solely to run this project: `npm ci` installs the project's CLI. Do not copy outdated Nest 11 installation commands into this Nest 12 project.

## 3. Clone the review branch and install

```bash
git clone https://github.com/thequietenso/lmbs.git
cd lmbs
git switch feat/complete-lmbs-monorepo
npm ci
```

The feature branch is the review source until its PR is merged. After merge, use the repository's default branch instead.

Use **one root lockfile**. `npm ci` reproduces its resolved versions. Use `npm install` from the root only when intentionally changing dependencies; inspect the lockfile diff before committing. Avoid `--force`, `--legacy-peer-deps`, and blind `npm audit fix --force`.

**Checkpoint:** `npm run test:workspace` verifies the three workspace declarations, application manifests and shared contracts.

## 4. Configure a database safely

### Native API environment

```bash
cp apps/api/.env.example apps/api/.env
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Generate the JWT secret locally and paste it into your private API `.env`. Never paste real passwords/tokens into teaching slides or source control.

Minimum settings:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
JWT_SECRET=YOUR_LOCALLY_GENERATED_RANDOM_SECRET
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
JWT_EXPIRES_IN=7d
```

The API `.env` lives at `apps/api/.env`. A root `.env`, when used, is for Docker Compose substitutions. A shell-exported `DATABASE_URL` overrides dotenv values: verify which database you intend to modify before any migration or seed.

### Supabase option

Create a project, then copy its exact connection URI from the provider's connection dialog. Use a connection mode reachable from your network; a session pooler may be appropriate on IPv4-only networks. Use the provider's exact host, port, username and TLS settings rather than a sample project host. URL-encode password characters that have URI meaning. Do not disable certificate verification to bypass a TLS error.

A generated Prisma client does not prove the hosted database is reachable. Applying new migrations to an existing shared database requires a backup, review of the SQL, and explicit owner approval. No hosted database migration is part of this verification run.

### Local PostgreSQL via Compose

```bash
cp .env.example .env
# Edit root .env and replace POSTGRES_PASSWORD and JWT_SECRET placeholders.
docker compose up -d postgres
```

Set the native API connection to `postgresql://lmbs:YOUR_PASSWORD@localhost:54329/lmbs`. Use a URL-safe password or encode it correctly. This starts only PostgreSQL; it does not automatically migrate the database.

## 5. Understand Prisma 7 and apply committed migrations

Prisma's configuration is `apps/api/prisma7.config.ts`. It selects the schema, migration directory, seed command and datasource URL. The schema retains `prisma-client-js` with an explicit generated output. PostgreSQL connects through `@prisma/adapter-pg` and `pg`.

```bash
npm run db:generate
npm run db:deploy
```

- **Generate** creates the client code/types; it does not modify database tables.
- **Migrate deploy** applies already-reviewed migration files.
- **Migrate dev** creates development migrations and may need a shadow database; it is not a substitute for deploy on shared environments.

When teaching a new schema change, use a separate development database:

```bash
npm run db:migrate -- --name describe_the_change
npm run db:generate
```

Do not create a third `init` migration or reset an existing database just to silence migration warnings. Read each SQL migration and discuss nullable authentication fields, defaults, indexes, soft deletion and constraints.

Optional inspection:

```bash
cd apps/api
npx prisma validate --config prisma7.config.ts
npx prisma migrate status --config prisma7.config.ts
npx prisma studio --config prisma7.config.ts
cd ../..
```

## 6. Seed development data and bootstrap staff deliberately

```bash
SEED_DEMO_DATA=true npm run db:seed
```

The seed must be repeatable: stable unique keys identify existing demo records rather than generating a new ISBN on every execution. Existing loans/copies must not be reset simply because the seed was run again.

Public registration creates **patrons only**. A classroom librarian/admin account must not be created by supplying a privileged role to `/auth/register`. Optional admin bootstrap uses private API environment settings:

```dotenv
SEED_ADMIN_EMAIL=YOUR_CLASSROOM_ADMIN_EMAIL
SEED_ADMIN_PASSWORD=YOUR_UNIQUE_STRONG_PASSWORD
SEED_ADMIN_NAME=Classroom Administrator
```

Set these locally before seeding. No shared demo administrator password is committed. Remove bootstrap password configuration after creating the account. Existing members without a password hash are library records, not accounts with an empty/default password.

## 7. Start the API and frontend

```bash
npm run dev
```

Or run separate terminals:

```bash
npm run dev:api
npm run dev:web
```

- API base: `http://localhost:3001/api/v1`
- Frontend: `http://localhost:5173`

```bash
curl -i http://localhost:3001/api/v1/health
curl -i 'http://localhost:3001/api/v1/books?page=1&limit=2'
```

Expect health to report database connectivity, and books to return a pagination envelope rather than a bare array. A TCP connection alone is not a working API/database check.

## 8. Teaching sequence: how the backend was completed

### A. Establish a baseline

Read the old spec, actual controllers/services, Prisma schema and frontend API client. The original build passed but two generated Books tests failed because Prisma dependencies were not provided; other scaffold tests did not establish business behavior. Authentication was described as complete but was absent; review/activity/genre modules contained placeholder strings.

### B. Establish the monorepo

Back up both original projects, retain the backend `.git` history, make the neutral root the repository, and import React under `apps/web` without its nested `.git`. Add npm workspace declarations, shared types, ignore rules and structural tests. Stop committing generated clients and dependency/build folders.

### C. Establish the HTTP contract

Use `/api/v1`, actual port 3001, typed request DTOs, explicit validation and paginated collections. Keep `Book._id`/genre string compatibility and flattened loan relations. Replace anonymous inline body types with runtime-validated classes; TypeScript interfaces alone do not validate HTTP input.

### D. Make circulation consistent

Demonstrate a transaction: verify the active member, atomically reserve an available copy, insert the loan and audit entry, then emit a notification after commit. A return must claim a still-open loan before incrementing stock; duplicate or concurrent returns must not add multiple copies. Renewals use their own validated operation, not unrestricted updates to arbitrary loan fields.

### E. Add authentication and authorization

Passwords use salted scrypt, never plaintext or an empty default. Signed expiring JWTs identify a real active database member. Authorization checks current identity/role; public signup cannot choose a privileged role. Private member/loan/activity data is staff-only; patron self-service is scoped to the current identity. Discuss why disabling a UI button does not replace server authorization.

### F. Add operational boundaries

Normalize errors, avoid exposing database internals, log request metadata without passwords/tokens, validate environment configuration, restrict CORS and limit request rates. Protect catalog updates from stale versions and creation requests from duplicate retries when an idempotency key is supplied.

### G. Integrate the frontend

Replace local-only member/circulation mutations with asynchronous API operations in connected mode. Replace stale local collections with authoritative server snapshots, including an empty collection. A failed server write must show an error, never silently save locally and claim success. Keep standalone demo mode explicit and isolate it from authenticated/private data.

### H. Verify and document

Run unit/component checks, real PostgreSQL migrations and HTTP workflows, concurrency tests, and browser acceptance. Check the compiled production entry and generated-client runtime path. Review the entire public source tree for local paths/secrets before publishing a feature branch and PR.

## 9. Run quality checks

```bash
npm run test:workspace
npm run build
npm run lint
npm test
```

Database integration requires a **separate disposable test database**. Never point `TEST_DATABASE_URL` at hosted or operational data:

```bash
TEST_DATABASE_URL="postgresql://test:test@localhost:5432/lmbs_test" npm run test:e2e
```

The opt-in smoke script additionally requires a running isolated loopback API and explicit test administrator credentials:

```bash
LMBS_SMOKE_BASE_URL="http://localhost:3001/api/v1" LMBS_SMOKE_ADMIN_EMAIL="YOUR_TEST_ADMIN_EMAIL" LMBS_SMOKE_ADMIN_PASSWORD="YOUR_TEST_ADMIN_PASSWORD" node tests/api-smoke.mjs
```

It creates test records and tests real concurrency; use only a disposable service/database. Do not turn these example placeholders into classroom-wide credentials.

## 10. Production build and local containers

```bash
npm run build
npm run start:prod --workspace=apps/api
```

The backend compiles to `apps/api/dist/main.js`; the generated JavaScript client stays beside `dist` at `apps/api/generated/prisma`. Both must be shipped. The original build layout included files outside src and produced an inconsistent entry path; the completed build limits production compilation to src. The compiled API was actually started during verification, not merely type-checked.

Full Compose stack:

```bash
docker compose up --build
```

Open `http://localhost:8080`. Nginx serves frontend assets and proxies `/api/` and `/socket.io/` to the private API service. Compose does not publish the API port: browser/API access is through port 8080. Nginx overwrites forwarded-client headers, and only this one-hop topology opts into `TRUST_PROXY_HOPS=1`. Native API access defaults to `0` and ignores spoofed forwarding headers. The web build uses `VITE_API_BASE_URL=/api/v1`; native Vite development uses the explicit localhost base unless configured otherwise.

Stop services with `docker compose down`. Retain volumes unless you deliberately intend to delete development data. TLS termination, managed secrets, backups, distributed rate limits and production deployment remain separate operational work.

## 11. Troubleshooting

| Symptom | Evidence to inspect / remedy |
|---|---|
| `ETARGET` despite an existing package version | Check registry metadata and cache freshness. A fresh `npm install --prefer-online` resolved stale metadata during workspace setup; do not edit version ranges blindly. |
| npm tarball timeout | Check connectivity/proxy/DNS and actual package URL, then retry within a bounded timeout. Prefer the committed lockfile; do not disable integrity checks. |
| Peer dependency conflict | Compare all Nest versions and the intended workspace; avoid forced peer resolution. |
| Missing generated client | Run root `npm run db:generate`; check schema output and compiled runtime copy. |
| P1001 / database unreachable | Verify project availability, exact provider URI, network/IP support and firewall. Generation does not establish connectivity. |
| TLS/URI errors | Use provider instructions and URL-encoded password; never log a connection string to diagnose it. |
| Startup refuses config | Supply DATABASE_URL and a sufficiently strong JWT_SECRET; verify working directory and dotenv precedence. |
| Browser CORS failure | Match actual frontend scheme/host/port to CORS_ORIGIN. Authorization and idempotency headers must be allowed. |
| API returns 401/403 | Log in with the correct account; patrons cannot manage the catalog or see staff records. |
| Changed database schema but stale types | Apply the reviewed migration, then regenerate and rebuild. |
| Empty server catalog still shows demo books | Ensure API mode replaces collections rather than merging with local demo state. |
| Compiled API cannot start | Check start:prod entry, generated-client location and runtime dependencies, not just tsc success. |

## 12. Approval boundaries and acceptance record

The user approved the public monorepo migration, repository rename, frontend import/integration, feature branch, commits and PR. No merge, force push, hosted migration/reset, paid service or hosted deployment is authorized. Original source backups are private and excluded from Git.

Final command results, browser evidence, independent-review dispositions and container/CI limits are recorded in [docs/verification.md](docs/verification.md). This guide distinguishes reproducible instructions from operations actually performed; it does not claim a student's Supabase migration has already run.
