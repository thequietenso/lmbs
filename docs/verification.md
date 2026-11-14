# LMBS verification and review record

## Scope and provenance

Verified on 2026-11-14 for `feat/complete-lmbs-monorepo`, continuing original backend main commit `eeb5cbc2f9ed272fb03c78a9a68c7ab4dcbaa0c3`. The backend and frontend were migrated into one npm workspace without replacing history. Original source and Git metadata were privately backed up before restructuring; original frontend remains outside publication through ignore rules.

No hosted Supabase migration, seed, deployment, merge, history replacement or visibility change was performed. GitHub repository rename/public frontend import were explicitly approved. All database writes below target newly created disposable local databases or the separate `lmbs-verify` Compose project.

## Executed source checks

| Check | Result |
|---|---|
| `npm run test:workspace` | 4 passed, including private-proxy topology checks |
| `npm test --workspace=apps/api -- --runInBand` | 17 passed across 5 suites |
| `npm test --workspace=apps/web` | 32 passed |
| `TEST_DATABASE_URL=<isolated-local-test-db> npm run test:e2e` | 14 passed against real PostgreSQL/HTTP/Socket.IO |
| `npm run build` | Shared, API and frontend TypeScript/production builds passed |
| `npm run lint` | Type-aware API lint and frontend lint passed |
| Real HTTP smoke `tests/api-smoke.mjs` | 20 checks passed: auth/RBAC, pagination, idempotency, stock concurrency, duplicate returns, renewal, audits/stats and validation |
| Authenticated browser smoke `tests/browser-smoke.mjs` | 10 checks passed against both native development and the containerized same-origin application |
| Browser rendering | Desktop 1440×1000 CSS viewport/DPR 1; mobile 390×844 CSS viewport/DPR 1; full-page captures; no horizontal overflow or browser runtime exceptions |
| Capture stability | Reduced motion, fonts settled, toasts dismissed; each final image required consecutive byte-identical browser captures |

Jest reports the installed NestJS packages' required experimental VM-modules warning; this is disclosed rather than counted as a failure. Database tests intentionally clear the dedicated `test` database and refuse hosted/non-test targets. Smoke scripts create records and must only run against an isolated local application.

### Coverage actually measured

Final real-database e2e coverage over `apps/api/src/**/*.ts`: **90.35% lines, 89.30% statements, 72.76% branches, 88.65% functions**. This is e2e coverage, not a claim that every service/DTO branch is covered. Separate unit tests exercise logging, proxy configuration, crypto and invalid configuration. The compiled entry point is exercised through actual process/container startup, not counted as covered by Jest.

## Runtime and containers

- A clean PostgreSQL 17 database accepted all three committed migrations.
- Repeatable seeds use stable keys and preserve existing circulation; inventory readback found no mismatches.
- `start:prod` actually started the compiled API; health/version returned HTTP 200 with database connected.
- Root lockfile was regenerated from manifests in a clean directory, not inherited from an installed dependency tree. All nonbundled registry packages carry resolved/integrity metadata; optional bundled children legitimately do not have separate tarball resolutions.
- Both Docker targets built through actual clean `npm ci` with Node 24/npm 11, Prisma generation and complete workspace build.
- `docker compose up -d --build` actually started the database, successful one-shot migration, API and Nginx frontend. The migration exited 0; PostgreSQL reported healthy.
- Through Nginx, `/api/v1/health` returned connected and `/version` reported Node `v24.22.3`.
- API container host port bindings were `{}`: the proxy-trusting API is not directly published. Frontend and local PostgreSQL bind only to loopback.
- Real browser login, full book metadata, member creation, issue/renew/return, authenticated realtime invalidation and logout passed through the Nginx same-origin deployment, not only the Vite server.
- An initial slim-image OpenSSL probe failed; the shared Docker base was corrected. Final runtime readback confirmed OpenSSL **3.0.22**, successful migration/health, and the complete 67-test/lint suite passed inside the clean Node 24 image.
- Verified API image: `sha256:6c3fa8fb5442cbfab6d74fee98bb4d5359a971fe2f02347cfcf63b9867a3cfbd`; web image: `sha256:441cb3041f4195db62b308bb14256059bce2ad19d0bad32d47e67b6c9aeb8586`. Local root lockfile and image lockfile SHA-256 both equal `083ed1f6ffbca5004e627911a77d1285baa791d7d3415344db2a5d8362641e10`.
- The 20 real HTTP checks passed again through the final OpenSSL-equipped Nginx/API deployment.

### Real proxy identity acceptance

Six simultaneous clients on the application bridge, each with a different transport IP, received `[401,401,401,401,401,401]` for invalid login attempts through Nginx: they did not share a five-request bucket. The first client then rotated forged forwarded headers while using uppercase login paths and received `[401,401,401,401,429]`, enforcing its sixth total auth request. Its ordinary quota allowed 100 reads then 429; another client still received 200.

This validates actual proxy behavior in addition to the database-free HTTP regression tests. Nginx overwrites forwarding chains; direct/native mode ignores them. The one-hop setting must not be reused for an API directly reachable by untrusted clients.

## Independent review and dispositions

The initial independent review identified four Important findings and no Critical findings. Its complete recovered report is [review-findings.md](review-findings.md). That report describes the **pre-fix review snapshot**, not present-tense unresolved defects. Parent fixes were verified by failing regressions first and the complete green suite; no second independent post-fix approval is claimed.

| Finding | Disposition / evidence |
|---|---|
| I1: case-insensitive auth routes bypassed strict throttle | Fixed; mixed-case/trailing-slash shared-bucket regression failed before normalization and passes afterward; actual proxy uppercase requests also enforce the quota |
| I2: blank optional ISBN broke edits | Fixed; blank/whitespace ISBN values are omitted from create/update payloads; regression failed before the change and passes afterward. Empty editing leaves an existing ISBN unchanged; an explicit clear-value API remains unsupported |
| I3: overlapping failed refresh could unlock a stale confirmed write | Fixed; a confirmed write marks reconciliation required until a winning authoritative snapshot commits. Overlapping-refresh regression failed before the change, passes afterward, and rejects a second write while stale |
| I4: proxy clients shared a transport-IP bucket | Fixed; explicit trusted-hop setting only in private-API topology, no API host publication, Nginx overwrites forwarding headers. HTTP/topology regressions failed before changes; real-container client separation/spoof-resistance checks passed afterward |

### Decisions retained

- Retain actual API port 3001 for native development; use `/api/v1` behind Nginx port 8080 for containers.
- Use salted scrypt plus a fixed-algorithm, issuer/audience/expiry-checked HS256 implementation instead of the earlier spec's unimplemented bcrypt/Passport proposal. This custom verification surface received crypto tests and independent review; mature auth-provider integration remains possible later.
- Blank ISBN means omitted/unchanged, not a shared empty unique identifier. Clearing an existing ISBN needs a separately defined nullable/clear contract.
- Preserve old migrations rather than rewrite history. Review destructive historical evolution/applied migration state and reconcile legacy invalid rows before any hosted rollout; new constraints intentionally use NOT VALID for legacy compatibility.

## Deferred minor/follow-up work

- Signup form's native minimum-length hint remains eight while the server enforces twelve. Server rejection is visible; align the UI constraint/copy in a follow-up.
- Frontend wire types should explicitly model nullable metadata/phone and numeric genre identity instead of relying on form normalization.
- Full staff refresh currently fetches five collections and two statistics endpoints; mutation refreshes and realtime echoes can amplify requests. Rapid automation reached the intended 100/minute limit. Coalesced/targeted refresh and large-catalog pagination/virtualization are follow-up work, not an excuse to disable throttling.
- In-memory throttling and best-effort realtime are single-instance; there is no distributed limiter, durable outbox/replay, password reset/email verification, refresh-token rotation, fine-payment service or automatic backup/restore.
- Full-text search/tagging, backend report exports and mobile apps remain future phases.
- No hosted deployment, TLS termination, production load acceptance or hosted migration is claimed. Final GitHub CI/publication state is recorded after the push rather than inferred from local checks.
