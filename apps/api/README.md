# LMBS API

NestJS 12 + Prisma 7/PostgreSQL. Run workspace commands from the repository root with `--workspace api`, or run the scripts below from this directory. HTTP and authenticated Socket.IO share port **3001**. HTTP prefix: **/api/v1**.

## Setup and commands

1. Install the root npm workspace dependencies (`npm ci`). Use the repository's supported Node version (Node 24 LTS recommended).
2. Copy `.env.example` to `.env` and supply your own PostgreSQL URL and random JWT secret. Never commit `.env`.
3. `npm run prisma:generate` generates the ignored `generated/prisma` JavaScript runtime.
4. For a new/local database: `npm run prisma:migrate:deploy`. Review every migration before applying to a populated or hosted database.
5. Optional: set `SEED_DEMO_DATA=true`, and/or explicit `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (12–128 characters), `SEED_ADMIN_NAME`; then `npm run prisma:seed`.
6. `npm run dev`, or `npm run build && npm run start:prod`.

Build output is `dist/main.js`. The generated runtime must remain at **apps/api/generated/prisma**, beside `dist/`, because compiled `dist/prisma/*` imports `../../generated/prisma/client`. Deployment must ship both `dist` and `generated`, plus production dependencies. `prisma:generate` is required after a clean checkout/schema change; never publish the generated client in Git.

Environment:

| Variable | Rule |
|---|---|
| DATABASE_URL | Required PostgreSQL connection URI |
| JWT_SECRET | Required unique secret, at least 32 bytes; no insecure fallback |
| PORT | Integer 1–65535; default 3001 |
| TRUST_PROXY_HOPS | 0 by default for direct/native access; Compose uses 1 only behind its private single Nginx proxy |
| JWT_EXPIRES_IN | Seconds or suffix s/m/h/d, 1 second–30 days; default 7d |
| CORS_ORIGIN | Comma-separated exact HTTP(S) origins; default localhost:5173 and localhost:3000; wildcard rejected |
| SEED_DEMO_DATA | Only literal `true` enables deterministic example data |
| SEED_ADMIN_EMAIL/PASSWORD | Both required together for optional bootstrap; never defaulted |
| SEED_ADMIN_NAME | Optional bootstrap display name |

The application fails before listening when configuration is invalid. Request bodies have a 100 KB Express default limit. Native/direct access ignores forwarded headers (`TRUST_PROXY_HOPS=0`). The supplied Compose topology does not publish the API port; Nginx overwrites X-Forwarded-For and the API explicitly trusts one hop (`1`). Never use that one-hop setting with an API reachable directly by untrusted clients. Configure an upstream distributed limiter for multi-instance deployment.

## Authorization policy

Public: book and genre reads; health/version; register/login. Registration rejects unknown fields (including role) and always writes `patron`. Every protected HTTP request checks the current database account, not a token role claim. Deleted or non-active accounts cannot authenticate.

Staff means `librarian` or `admin`. Staff-only: member/loan/activity/statistics reads; catalog/member/circulation mutations; genre mutations. No public role-promotion endpoint exists. The optional seed can create an administrator but refuses to promote an existing non-admin account.

Any active authenticated account may read `/auth/me`, `/auth/me/loans`, and CRUD **its own** reviews. Reviews are private to their owner even for staff; staff cannot modify another member's review. Review list filters never override ownership. Staff circulation reads include member names/emails; anonymous/patron collection reads are forbidden.

Password hashes are nullable for existing non-login members. Such members cannot log in and registration does not silently claim an existing email. Passwords use asynchronous Node scrypt with explicit N=32768/r=8/p=3 parameters, random 16-byte salts and constant-time key comparison. JWTs use fixed HS256 with HMAC verification, issuer/audience/expiration checks; no algorithm selection from untrusted headers and no password/hash fields in responses.

## HTTP contract

Lists return `{data,total,page,limit}`. Pagination: page >= 1, limit 1–100 (default 50). Unknown body/query fields and explicit nulls are rejected. Standard errors: `{statusCode,message,error,details}`; validation details contain messages. Prisma missing rows map to 404, duplicate/foreign-key/concurrency conflicts to 409. Internal errors are redacted.

| Method | Path | Access / behavior |
|---|---|---|
| GET | /books | Public; page,limit,genre (exact name),available=true/false,search |
| GET | /books/:id | Public |
| POST | /books | Staff; optional Idempotency-Key |
| PUT | /books/:id | Staff; optional updatedAt optimistic concurrency |
| DELETE | /books/:id | Staff; soft delete; rejects outstanding loans |
| GET | /genres | Public paginated list |
| GET | /genres/:id | Public; integer ID |
| POST | /genres | Staff; name, optional description |
| PUT | /genres/:id | Staff; partial name/description |
| DELETE | /genres/:id | Staff; referenced genres return 409 |
| GET | /members | Staff; page,limit,status |
| GET | /members/:id | Staff; no hash fields |
| GET | /members/:id/loans | Staff; paginated loan history |
| POST | /members | Staff; name,email, optional phone,membershipNumber,status,bio,hobbies |
| PUT | /members/:id | Staff; partial member fields, never role/password |
| DELETE | /members/:id | Staff; soft delete/inactive; rejects outstanding loans |
| GET | /loans | Staff; page,limit,status,bookId,memberId |
| GET | /loans/:id | Staff |
| POST | /loans | Staff; bookId,memberId,days (1–365),optional notes; optional Idempotency-Key |
| PUT | /loans/:id/return | Staff; no body or `{}` only; server controls return time and fine |
| PUT | /loans/:id/renew | Staff; days 1–365 (default 14) |
| GET | /activities | Staff; paginated newest-first audit, no public write route |
| GET | /stats/books | Staff; totalBooks,totalCopies,availableCopies,borrowedCopies,byGenre name→count |
| GET | /stats/loans | Staff; totalLoans,activeLoans,overdueLoans,totalFines,returnRate (percentage) |
| POST | /auth/register | Public; name,email,password (12–128 characters) |
| POST | /auth/login | Public; email,password |
| GET | /auth/me | Active authenticated account; safe member profile |
| GET | /auth/me/loans | Active authenticated account; own paginated loans only |
| GET | /reviews | Active authenticated account; own page,limit,optional bookId |
| GET | /reviews/:id | Owner only |
| POST | /reviews | bookId,rating (integer 1–5),optional comment |
| PUT | /reviews/:id | Owner only; partial rating/comment |
| DELETE | /reviews/:id | Owner only |
| GET | /health | Public; real DB query; 503 if unavailable |
| GET | /version | Public; version,name,node |

Login/register return `{access_token,user}`; send `Authorization: Bearer <token>` thereafter. POST success is 201; PUT/DELETE success is 200.

Books include `_id`, string `genre`, numeric `genreId`, title,author,isbn,pages,publishedYear,totalCopies,availableCopies,shelfLocation,description,coverGradient,createdAt,updatedAt. Create title/author are required. Genre is resolved/upserted by name, defaults to General, or may use existing genreId; supplying conflicting name/ID returns 409. New books must start with all copies available. Total inventory updates preserve checked-out copies; arbitrary stock corrections are rejected. ISBN is an optional unique catalog identifier (not checksum-validated).

Loans include id,bookId,bookTitle,bookAuthor,memberId,memberName,memberEmail,borrowDate,dueDate,returnDate,status,fineAmount,notes,renewalCount. Circulation dates are UTC YYYY-MM-DD strings. Status is derived when read, so open loans become overdue without a scheduled write. Fine is **$0.50 per UTC calendar day after the due date**, calculated live for open loans and frozen on return. Return before/on due day has zero fine. Statistics include accrued open and assessed returned fines; no payment/waiver workflow is implemented. Active/overdue counts are separate; returned history remains after soft deletion.

## Transactions, retries and audits

Loan creation checks active/nondeleted member and nondeleted book, atomically decrements positive stock, inserts loan, and writes audit in one serializable transaction. Concurrent borrowers cannot oversubscribe. Returns conditionally update open loans and increment inventory only once; repeated returns return the existing result and do not write another audit. Renewals require active member, non-overdue/open loan, and at most two renewals. Mutations retry serialization failures up to five total attempts, then return 409. Catalog/member changes and review/genre writes audit transactionally with actor/entity IDs; logs do not contain request bodies, passwords, tokens, connection strings or raw DB exceptions.

Book `updatedAt` checks reject stale writes when provided. Omitting it is supported for older clients but loses optimistic conflict detection. Idempotency-Key on book/loan creation is scoped to actor+resource, printable ASCII up to 128 characters, stored durably in PostgreSQL with canonical payload hash and JSON response. Replays return the original response; altered payload returns 409. Keys are retained indefinitely (operators may design a retention policy). Realtime invalidations may repeat on a replay; clients must treat them as invalidations, not new authoritative rows.

New migrations add nullable auth fields, soft-deletion markers, indexes, review/inventory/member/loan constraints, restrictive foreign keys and idempotency storage. CHECK constraints are NOT VALID to preserve legacy invalid rows while enforcing new writes. **The two historical migrations predate this completion and include destructive schema evolution; they remain immutable.** Do not reapply their destructive SQL manually to existing databases. Back up, inspect applied migration history, reconcile legacy inventory and validate constraints before production rollout.

## Realtime

Socket.IO shares the HTTP server, path `/socket.io`; connect with `auth: {token: access_token}`. Origins are checked. Anonymous/expired/suspended identities are rejected. No client mutation/list acknowledgements exist: use HTTP for state and writes.

Server notifications: `book.created/updated/deleted`, `member.created/updated/deleted`, `loan.created/updated`. Payload envelope: `{event,payload,timestamp}`. Book events may reach all authenticated accounts; member/loan events reach only currently authorized staff. Staff join the `staff` room and account/role/token validity is rechecked before every broadcast, preventing stale privileges. Notifications emit only after commit, and are best-effort/in-process (not a durable cross-instance event bus). Always refetch HTTP state after reconnect. There is no outbox/replay delivery guarantee.

## Verification

- `npm test -- --runInBand`: validation, crypto/config, recursion and HTTP authorization tests without a database.
- `npm run build` and `npm run lint`.
- `TEST_DATABASE_URL=postgresql://...@127.0.0.1:PORT/lmbs_test npm run test:e2e -- --runInBand`: real HTTP/Socket.IO/PostgreSQL acceptance, concurrency, CRUD/RBAC, reviews, idempotency, fines/renewals, stats/audits, seeds. First deploy migrations to the same isolated test DB using an explicitly overridden DATABASE_URL.

**Integration tests clear tables.** They refuse nonlocal hosts and database names without `test`; never point them at a valuable local database or a hosted service. Missing TEST_DATABASE_URL fails rather than silently skipping tests. Tests do not read hosted `.env` credentials; explicit environment overrides take priority. Use a dedicated instance/container owned solely by the test run.

Current known deployment limits: in-memory rate limiting and best-effort notifications are single-instance; no refresh-token rotation, password-reset/email-verification, fine payment, backups automation, full-text search/tagging or report exports. TLS and operational monitoring belong at the deployment boundary. Hosted migrations/deployment are not automatically authorized.
