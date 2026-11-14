# Bibliotech LMBS — Architecture and Backend Specification

Document version 2.0. This supersedes the earlier backend blueprint, which mixed alternative stacks, outdated paths, and unverified completion claims. The selected design is an **npm-workspaces monorepo**, not separate frontend/backend repositories and not Nest CLI monorepo mode.

## 1. Purpose and scope

Complete the existing NestJS backend from its current code and integrate the React frontend, retaining an understandable classroom project. The backend is the authoritative source in API mode. Standalone demo mode remains a separate local-only experience.

**Included:** catalog and genres; member records/deactivation; borrowing/returning/renewals; reviews; audit activities; statistics; health/version; authentication/authorization; DTO validation; consistent errors; configuration/CORS/rate limits/logging; real-time change notifications; non-destructive migrations; deterministic demo seeds; tests; local container/CI definitions; comprehensive documentation.

**Excluded future phases:** PostgreSQL full-text search/tagging, new backend CSV/PDF report services, mobile clients, deployment to a paid/hosted platform, refresh-token/SSO/password-reset workflows, payment processing, and multi-instance distributed coordination. Existing client-side catalog exports are not a backend reporting service.

## 2. Selected architecture

```text
Browser (React/Vite)
  ├── HTTP /api/v1 ──▶ NestJS controllers
  │                    ├── DTO validation / authentication / authorization
  │                    └── services ──▶ Prisma + pg adapter ──▶ PostgreSQL
  └── Socket.IO ◀────── authenticated post-commit notifications
```

```text
lmbs/
├── apps/api/                    # NestJS application
│   ├── src/                     # Features and shared HTTP/config infrastructure
│   ├── prisma/schema.prisma
│   ├── prisma/migrations/
│   ├── prisma/seed.ts
│   ├── prisma7.config.ts
│   ├── test/
│   └── README.md                # Backend usage and endpoint reference
├── apps/web/                    # React frontend, client and state management
├── packages/shared/src/index.ts # Common pagination, auth and stats interfaces
├── tests/                       # Workspace and opt-in real API smoke tests
├── deployment/nginx.conf
├── compose.yaml
├── Dockerfile
├── package.json
├── package-lock.json
├── Installation_Guide.md
└── README.md
```

One Git history continues the original backend commit. Root workspace commands orchestrate independent application packages. Do not create a nested `.git`, duplicate dependency lockfiles, or commit generated Prisma code.

### Technology decisions

- Existing NestJS 12 / TypeScript backend; React 19 / Vite frontend.
- Prisma 7 `prisma-client-js`, generated under `apps/api/generated/prisma`; `PrismaPg` connects PostgreSQL using `pg`.
- Prisma CLI always receives `--config prisma7.config.ts`, invoked with the API workspace as working directory.
- Runtime DTO validation uses class-validator/class-transformer, not TypeScript interfaces alone.
- Authentication uses salted scrypt and expiring HS256 JWTs with an explicit strong environment secret; no fallback secret or shared default password.
- Socket.IO is notification-only. HTTP is the sole mutation interface; old placeholder websocket CRUD acknowledgements are not an implemented feature.
- Node.js 24 LTS recommended; root minimum 22.12.0. Exact dependency resolutions live in the root lockfile.

## 3. Data model and invariants

The Prisma schema and SQL migrations are the executable source of truth; this document describes relationships and business constraints instead of duplicating an entire schema that can drift.

| Model | Identity and constraints | Relationships / purpose |
|---|---|---|
| Genre | Integer primary key; unique name and slug | One-to-many books |
| Book | String primary key; optional unique ISBN; copy counts | Genre, loans, reviews; soft-deleted catalog entries retain history |
| Member | String primary key; unique email and membership number | Loans/reviews; nullable passwordHash supports existing non-login members; role defaults patron |
| Loan | String primary key; issue/due/optional return date | Exactly one book/member; historical record retained |
| Activity | String primary key; event type/title/description/timestamp | Server-generated audit history |
| Review | String primary key; integer rating 1–5 | One review per `(bookId,userId)`; user is a Member |
| Idempotency record | Scope/key/request fingerprint/response | Durable optional replay protection for supported creation endpoints |

- `0 <= availableCopies <= totalCopies`.
- Available copies change through inventory-aware book updates and transactional circulation, never arbitrary client-supplied counters.
- Borrowing requires an existing nondeleted book, an active member, and stock greater than zero.
- Issue, inventory decrement and audit write commit atomically. Concurrent requests cannot reserve more copies than exist.
- Return claims an open loan once, sets the return date/fine and increments stock once in the same transaction. Repeat/concurrent requests cannot inflate inventory.
- Fine policy: $0.50 per overdue day, with the exact date boundary documented alongside implementation/tests. No fine collection/payment feature is implied.
- Renew validates day bounds and open-loan/member eligibility, updates due date and logs the event; returned loans cannot be renewed.
- Deleting a member deactivates the record (`inactive`) rather than removing loan history.
- Book removal uses soft deletion and must not destroy circulation/review history.
- Database uniqueness/failure conditions map to controlled HTTP errors, not raw SQL/client internals.

Indexes cover book genre/title, member status, loan member/due/status and activity ordering where represented by the migration.

## 4. HTTP conventions

Native base URL: **`http://localhost:3001/api/v1`**. This retains the actual frontend configuration; earlier port-3000 prose was stale. In the local container deployment, Nginx exposes same-origin `/api/v1` through port 8080.

- JSON request/response bodies; create normally 201, reads/updates/removals 200.
- All list endpoints use `page` and `limit` and return `{data,total,page,limit}`. Defaults and upper bounds are validated by the shared pagination DTO, not trusted raw query strings.
- `Book` exposes `_id` for the existing frontend and `genre` as its name, not a nested relation object. Include inventory, metadata and timestamps.
- `Member` and `Loan` expose `id`. Loan response flattens `bookTitle`, `bookAuthor`, `memberName`, `memberEmail`; circulation date strings use `YYYY-MM-DD`.
- Password hashes never appear in DTOs, audit payloads, errors, logs or notifications.
- Mutations return the affected entity or a message, not a pretend full collection. Frontend refreshes the authoritative snapshot when required.

### Error envelope

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "BAD_REQUEST",
  "details": [{"field": "email", "message": "email must be an email"}]
}
```

400 invalid input/business eligibility; 401 missing/invalid/expired login; 403 insufficient role/ownership; 404 unavailable record; 409 duplicate/stale/idempotency conflict; 429 rate limit; controlled 5xx for unavailable infrastructure. Never expose stack traces, credentials or raw database diagnostics.

## 5. Authentication and access policy

| Actor | Access |
|---|---|
| Anonymous | Catalog/genre reads, health/version, signup/login |
| Patron | Public reads, own identity/loan history, own review mutations as permitted |
| Librarian/admin | Catalog, genre, member and circulation management; private activity/statistics reads; own-review access |

Admin is a privileged role, not proof that user-management/system-settings endpoints exist. Those surfaces must be separately specified before implementation.

| Method | Route | Contract |
|---|---|---|
| POST | `/auth/register` | `{name,email,password}` → `{access_token,user}`; always patron; reject privilege fields |
| POST | `/auth/login` | `{email,password}` → `{access_token,user}`; generic invalid-credential error |
| GET | `/auth/me` | Bearer token → current safe identity |
| GET | `/auth/me/loans` | Bearer token → current member's loan history, never another patron's records |

JWT verification pins HS256, validates signature/expiry/identity, and consults current member status/role. Nullable password hashes mean existing library member records cannot log in until a legitimate account is established; never store an empty-string default password.

Bootstrap admin creation is explicit through private `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, and optional `SEED_ADMIN_NAME`. It is not a public signup option. No preselected classroom administrator password is shipped.

## 6. API surfaces

All routes below are relative to `/api/v1`. Detailed accepted DTO fields and query filters are documented in `apps/api/README.md` from actual controller/service code.

### Catalog

| Method | Route | Behavior |
|---|---|---|
| GET | `/books` | Paginated visible catalog; genre/availability/search filters where supported |
| GET | `/books/:id` | Single visible book, 404 if missing/deleted |
| POST | `/books` | Staff create; title/author, optional complete catalog metadata and copies |
| PUT | `/books/:id` | Staff validated update; optional updatedAt conflict detection |
| DELETE | `/books/:id` | Staff soft deletion subject to circulation constraints |

Book forms can submit genre name; the service resolves its foreign key rather than hardcoding `genreId=1`. Keep optional genreId behavior explicit. Pages must be a nonnegative integer; published year must be in the selected documented range; counts cannot be negative. Empty/whitespace-only required titles/authors are invalid.

### Members

| Method | Route | Behavior |
|---|---|---|
| GET | `/members` | Staff paginated private member listing/status filter |
| GET | `/members/:id` | Staff safe profile |
| POST | `/members` | Staff registration of library record; unique identity fields |
| PUT | `/members/:id` | Staff validated profile/status update, not arbitrary password/role assignment |
| DELETE | `/members/:id` | Staff deactivation, preserving records |
| GET | `/members/:id/loans` | Staff member history |

### Circulation

| Method | Route | Behavior |
|---|---|---|
| GET | `/loans` | Staff paginated list; status/member/book filters |
| GET | `/loans/:id` | Staff single loan |
| POST | `/loans` | `{bookId,memberId,days,notes?}` → issued loan |
| PUT | `/loans/:id/return` | Empty `{}` (or no body); server sets return time/fine |
| PUT | `/loans/:id/renew` | `{days?}` → renewed open loan |

Issue/renew durations are integer days within 1–365. Legacy arbitrary status/fine updates and loan deletion are not the normal lifecycle API and must not remain as an authorization/stock-consistency bypass.

### Supporting modules

| Method | Route | Behavior |
|---|---|---|
| GET | `/activities` | Staff paginated audit log, newest first |
| GET | `/genres` | Public paginated catalog genres |
| GET | `/genres/:id` | Public genre lookup |
| POST/PUT/DELETE | `/genres` and `/genres/:id` | Staff validated management; never cascade-delete a populated catalog |
| GET | `/reviews` | Paginated review reads with explicit role/ownership scope |
| GET | `/reviews/:id` | Review lookup with access policy |
| POST | `/reviews` | Authenticated rating/comment for a book; bind author to current identity |
| PUT/DELETE | `/reviews/:id` | Owner only, including when staff is the caller |
| GET | `/stats/books` | `{totalBooks,totalCopies,availableCopies,byGenre}` |
| GET | `/stats/loans` | `{activeLoans,overdueLoans,totalFines,returnRate,totalLoans}` |
| GET | `/health` | Database connectivity and version; degraded health must not be reported as healthy |
| GET | `/version` | API version/name/runtime information |

Audit history is generated by server operations, not an unrestricted public CRUD log. No fake “sync complete” event is required merely because a browser refreshed its local state.

## 7. Concurrency, retries and side effects

- Optional `Idempotency-Key` on book and loan creation: persist key within caller/operation scope with a request fingerprint and the original response. Same request replays; reusing a key with a different payload returns 409. Business mutation and replay record must commit atomically.
- A supplied book `updatedAt` acts as an optimistic concurrency precondition; stale versions return 409 rather than silently overwriting a newer edit.
- Row/conditional updates and transactions protect inventory independently of browser controls.
- Audit writes belong to the same transaction as the mutation; notification emission occurs only after commit and never broadcasts password hashes.

## 8. Frontend state and realtime

The client consumes paginated server responses and sends complete book metadata and Bearer authorization. Authenticated connected operations call the server for books, members and circulation. Sync replaces snapshots, including empty collections, instead of merging stale local counts into current inventory.

Demo mode uses local sample data and is visibly identified. A failed connected mutation shows an error and leaves server-backed state unchanged; it never silently falls back to local success. Session changes clear private state. Switching API origin drops credentials before contacting another service. Tokens should not be saved to permanent localStorage alongside demo data.

Socket.IO shares the HTTP server and authenticates the handshake. Public catalog changes and staff-only member/loan changes are delivered to appropriate rooms. Notifications trigger refresh/invalidation rather than duplicate mutation handling. Disconnected, expired or deactivated identities must not retain private subscriptions indefinitely. Multi-node adapters and durable replay of missed realtime events are future work.

## 9. Environment and operational behavior

| Setting | Purpose |
|---|---|
| DATABASE_URL | Explicit PostgreSQL connection; required |
| JWT_SECRET | Strong explicit signing secret; required, no fallback |
| JWT_EXPIRES_IN | Configurable bounded token lifetime (default 7d, maximum 30d) |
| TRUST_PROXY_HOPS | 0 for direct/native access; 1 only for the supplied private-API/single-Nginx topology |
| PORT | API port, default 3001 |
| NODE_ENV | development/test/production |
| CORS_ORIGIN | Allowed frontend origins, comma-separated if supported; never production wildcard |
| SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_ADMIN_NAME | Optional deliberate administrator bootstrap |
| TEST_DATABASE_URL | Explicit isolated disposable integration database only |
| VITE_API_BASE_URL | Frontend build-time base override; container uses `/api/v1` |

Validate configuration at startup. Allow Authorization and Idempotency-Key headers through configured CORS. Rate limits target auth 5/min/IP and ordinary requests 100/min/IP. Single-process in-memory throttling is not distributed protection and must be described honestly. The bundled container API is not directly published; Nginx overwrites X-Forwarded-For and the API explicitly trusts one hop only in this private topology. Native access ignores forwarded headers by default. Logs include structured method/status/duration metadata, not bodies, secrets, authorization headers or connection strings.

## 10. Migrations, seeds and deployment

Preserve the two original migration files; add reviewed forward migrations. Existing members remain non-login records unless explicitly provisioned. Changes must not require dropping live data or fabricating passwords. Run committed migrations through deploy; generate the client separately. Never treat successful generation as a successful migration.

Seeds use stable unique keys and upsert without resetting existing circulation or duplicating catalog records. Demo members/loans/audit events are development fixtures, not operational history. Verify repeat execution against a disposable database.

Compose provides PostgreSQL health checks, a one-shot migration service, API and Nginx frontend. It does not seed staff passwords automatically. Root secrets remain outside the image/build context. TLS, host provisioning, backup/restore operations and hosted deployment require separate approval and validation.

## 11. Acceptance and evidence

Before ready-for-review:

1. Workspace checks, shared types, backend/frontend builds and lint pass.
2. Unit/API-client/state tests exercise rejection and failure behavior, not just generated class existence.
3. A new isolated PostgreSQL database accepts all migrations and a repeatable seed.
4. Real HTTP tests cover login/roles, validation, catalog/members/circulation, reviews/audit/stats, stale/idempotency behavior and concurrent stock/return protection.
5. The compiled API actually starts with the generated client; a browser loads the real frontend and exercises connected mode.
6. Independent review findings are addressed or explicitly disclosed.
7. Public source contains no secrets, personal paths, dependencies, generated clients or nested Git metadata; branch SHA/tree/README and PR are read back after push.

Current exact results and remaining runtime/container/CI limitations are recorded in `docs/verification.md` when checks complete. Do not convert this requirements checklist into unsupported “complete” claims.

## 12. Decisions requiring approval

Already approved: neutral public `lmbs` monorepo, rename of existing repository, frontend import, necessary frontend/backend changes, spec cleanup, teaching guide and backend README, feature branch/commits/push/PR.

Still require approval: merging to main, force pushes/history replacement, deletion of original backups, applying new migrations/seeds to the existing hosted database, destructive database commands, changing public visibility, paid infrastructure or hosted deployment, and adding unrelated future-phase features.
