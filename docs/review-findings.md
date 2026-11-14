# Independent review findings — recovery of initial review

**Recommendation: request changes. Four Important findings reproduced; no Critical finding identified.**

Reviewed 2026-11-14 on `feat/complete-lmbs-monorepo`, base HEAD `eeb5cbc2f9ed272fb03c78a9a68c7ab4dcbaa0c3`. Findings concern the uncommitted working tree, including untracked frontend/backend source, not the old HEAD alone. This recovers the interrupted initial review; it is **not a post-fix approval**. Another worker was adding regression tests/documentation during recovery, so this is not an immutable tree snapshot. Line references describe the source observed during reproduction.

Read the root specification, implementation plan, backend/frontend READMEs, authentication/validation/bootstrap, frontend API/state/provider/form code and deployment proxy configuration. Scope was read-only source inspection and database-free tests/probes. No implementation changes, dependency changes, migrations, seeds, destructive e2e tests, hosted operations, commits or pushes were performed by this reviewer. Only this report was added inside the repository.

> **Disposition update:** This report preserves the independent **pre-fix** review. I1–I4 have since been addressed by the coordinator with RED→GREEN regressions and a full passing suite; real proxy/browser acceptance also passed. See [verification.md](verification.md) for fixes, remaining minor items and verification limits. No independent post-fix re-approval is implied.

## Important findings

### I1 — Case-insensitive auth routes bypass the strict authentication rate bucket

**Location:** `apps/api/src/authentication/guards.ts:53–56,65`.

The guard identifies auth requests using `/\/auth\/(?:login|register)\/?$/` without a case-insensitive flag. The Express router accepts mixed-case routes. Consequently the same login handler is limited to five requests per minute via `/api/v1/auth/login`, but mixed-case variants enter the ordinary 100-request bucket instead. This weakens both login brute-force protection and signup resource-abuse protection; it is a bypass of the strict limit, not an unlimited-requests claim.

**Reproduction:** A database-free Nest test application registered a stub login controller and the **current source** `RateLimitGuard` globally. Seven successive POSTs to lowercase login and then seven to uppercase login from the same test peer returned:

```text
lowercase [201, 201, 201, 201, 201, 429, 429]
uppercase [201, 201, 201, 201, 201, 201, 201]
```

The stub avoids hashing/database writes; it verifies router acceptance and guard classification, not authentication success against a real account. Existing source-level regression added by another worker also fails: `apps/api/test/core.spec.ts:103` expects the sixth request across mixed-case login/register variants to throw, but it does not.

**Requested change:** Select buckets by normalized route identity or matched handler metadata, or align route matching and classification explicitly. Do not merely special-case the one uppercase spelling. Keep login and registration in the intended shared strict bucket.

**Acceptance regression:** Alternate lower/upper/mixed-case login and register paths, including accepted trailing-slash variants; after five total requests from one identity, the sixth must be 429. Ordinary routes must retain their separate limit.

### I2 — Optional ISBN becomes an invalid mandatory payload during book editing

**Locations:** `apps/web/src/services/bookForm.ts:3–10`; `apps/web/src/components/Modals/BookModal.tsx:72–87`; `apps/web/src/services/api.ts:129–134`; `apps/api/src/books/dto/create-book.dto.ts:17–21` (inherited by update DTO).

A valid server book can have no ISBN. `editableBookValues` converts its null/absent ISBN to `''`; modal validation permits that value, and `bookPayload` forwards it unchanged. Backend validation skips an absent property but rejects a supplied blank ISBN with `Length(1,32)`. Thus editing an unrelated title or inventory field on a no-ISBN book fails unless the operator invents an ISBN. Clearing an existing ISBN through the form fails too. The issue is the client/server optional-value contract; optional fields that explicitly allow empty strings are not being claimed to fail here.

**Reproduction:** Current `editableBookValues` run with `{isbn:null,...}` produced `isbn: ""`. A database-free Nest controller with the **current source** `UpdateBookDto` and production-equivalent transform/whitelist validation received `PUT /api/v1/books/example` with `{title:"Edited",isbn:""}` and returned:

```json
{"message":["isbn must be longer than or equal to 1 characters"],"error":"Bad Request","statusCode":400}
```

The supplied identifier is a probe route value; validation rejects before any service/database work. A production authenticated request carrying the same DTO has the same validation conflict.

**Requested change:** Agree on an absent-value/clear-value policy for optional unique ISBN. At minimum omit empty ISBN for no-ISBN creates/unchanged edits; define an explicit supported clear operation if clearing is intended. Do not just allow and persist the same empty unique value for every no-ISBN book. Preserve genuine ISBN values and stale-version protection.

**Acceptance regression:** Create without ISBN; reopen and save title/inventory edits without adding ISBN; verify no-ISBN books do not collide; test clearing an existing value according to the chosen contract. Add the real form → API payload → DTO combination, since isolated helper/payload tests currently miss this integration failure.

### I3 — Superseded refresh can falsely reconcile a successful write and unlock a stale snapshot

**Locations:** `apps/web/src/context/libraryStore.ts:133–151,155–175`, especially the early successful return at line 146 and the mutation's `await this.sync()` at line 164; management gate at lines 68–72. Realtime source: `apps/web/src/context/LibraryContext.tsx:59–69`.

After a successful connected write, mutation follow-up refresh A can overlap a later realtime/manual refresh B. B increments `syncSequence`. If A then completes, it returns without applying data, but resolves normally. `mutate` interprets that as successful reconciliation and releases its pending lock. If B fails, its catch sets only connectivity/error, not `needsSync`. The old snapshot remains visible and further writes are permitted despite the confirmed write never having been reconciled. This contradicts the documented saved-on-server/refresh-failed lockout and can encourage duplicate operations or stale edits.

**Reproduction using actual TypeScript API/store modules and a mocked fetch boundary:**

1. Log in as staff; initial catalog contains `old`.
2. Let a book POST succeed, but hold its follow-up `/books` response A.
3. Start `store.sync()` B; hold its `/books` response.
4. Release A with catalog containing `new`; await the mutation. A is superseded and commits nothing.
5. Reject B with `Realtime refresh failed`.
6. Inspect snapshot and attempt another add.

Actual output:

```text
race {"books":[{"_id":"old"}],"needsSync":false,"error":"Realtime refresh failed"}
writes permitted after stale failed winning refresh 2
```

Assertions verified old catalog retention, false `needsSync`, and two network writes. A newly added regression by another worker independently fails at `apps/web/tests/store.test.mjs:101`: expected reconciliation lock `true`, received `false`.

**Requested change:** Mark a confirmed connected write as requiring reconciliation immediately; clear that marker only when an applicable authoritative snapshot actually commits. A superseded refresh must not count as successful reconciliation. Coalescing/serializing refreshes may help, but must preserve session/epoch invalidation and guarantee a refresh that covers the write, not merely any older in-flight read.

**Acceptance regression:** Exercise the ordering above; all further management actions remain blocked until a later successful authoritative refresh commits. Also cover a successful winning refresh and session/origin changes while both reads are pending.

### I4 — Bundled reverse proxy collapses all clients into one rate-limit identity

**Locations:** `deployment/nginx.conf:6–10`; `apps/api/src/authentication/guards.ts:56`; `apps/api/src/main.ts:7–11`; `apps/api/src/common/bootstrap.ts:7–19`.

Nginx forwards `X-Forwarded-For`, but API initialization never configures a trusted proxy policy. Express therefore uses the direct transport peer (the Nginx container) for `req.ip`. The in-process limiter keys that peer, so all users behind the supported proxy share five authentication requests and 100 ordinary requests per minute. A few distinct legitimate users can block each other; one user can exhaust everyone else's quota. This is distinct from the documented single-instance/non-distributed limitation: even one API instance behind the supplied proxy misattributes clients.

**Reproduction/evidence:** The Nest Express application reports `trust proxy false`. Six calls to the actual source guard with the same Nginx-like transport `ip` and six distinct forwarded-client headers produce:

```text
six distinct forwarded clients / same transport peer
['allowed', 'allowed', 'allowed', 'allowed', 'allowed', 429]
```

This is a database-free identity/bucket probe plus proxy/application source tracing, **not** a claim that Docker/Nginx was launched during this review. The prior review transcript independently recorded `trust proxy setting false`; its final text was truncated, so this recovered actionable finding is not represented as a verbatim reconstruction of its lost wording.

**Requested change:** Establish a safe trusted-proxy boundary for the supported topology, or perform correctly keyed limiting at Nginx and document its division of responsibility with the API. Do not blindly trust arbitrary `X-Forwarded-For` from a directly accessible API. Restrict API exposure/proxy hops as necessary and make forwarded-header handling resistant to spoofing.

**Acceptance regression:** Through the configured proxy, six distinct client identities must not share the same five-request auth quota, while six requests from one identity must. Verify that direct API access cannot select arbitrary identities using forged forwarded headers. Check ordinary-request quotas too.

## Additional investigation: 429 request amplification

**Locations:** `apps/web/src/context/libraryStore.ts:140–144,164`; `apps/web/src/context/LibraryContext.tsx:60–68`; `apps/web/src/services/api.ts:91–103`.

The parent observed a fresh scripted browser workflow exceeding 100 requests/minute. Source inspection and a deterministic fetch-count probe identify a concrete amplification mechanism; they do **not** establish an infinite pagination loop or reproduce the exact browser timing.

- A staff sync fetches five collections plus two statistics endpoints: seven HTTP requests when every collection fits one page (including empty collections).
- Every successful management mutation performs a complete sync.
- The originating authenticated socket also receives relevant notifications and schedules another complete sync after 150 ms. This debounce coalesces nearby socket events only; it does not deduplicate against mutation-driven or already in-flight syncs. Connecting/reconnecting also schedules a sync.
- Older syncs losing the sequence race still perform their requests; the sequence check discards results, not work.
- The pagination loop requests sequential pages until `page * limit >= total`; it rejects empty premature pages and invalid metadata. No self-sustaining page loop was demonstrated against valid server metadata. Larger real datasets legitimately add more requests per sync.

**Measured:** Seven `store.addBook` calls each followed by one separately timed realtime-equivalent `store.sync()` made **105 HTTP requests**, excluding login/startup/socket-connect reads. The probe used the actual API/store and one-page valid responses. It deliberately invokes the same callback operation as realtime; it does not run a live socket or claim every network schedule always produces two full syncs. On a fast workflow this fanout can exhaust the intended 100/minute budget even with only one user, before I4's shared-proxy quota makes it worse.

**Recommendation:** Treat as an additional performance/availability follow-up alongside I3/I4. Coalesce refreshes across all triggers; avoid redundant originator refreshes where safe; support targeted invalidation or narrower snapshots; retain a queued refresh when a write occurs during an older read. Add a bounded HTTP-request-count test and a slow/overlapping-notification case. Do not simply raise/disable the limiter to conceal the amplification. Exact browser trace attribution remains unverified here.

## Minor / deferred

1. **Signup minimum mismatch:** `apps/web/src/components/AccountPanel.tsx:62` sets registration `minLength=8`, but `apps/api/src/common/dto.ts:115` requires 12. Eight-to-eleven-character passwords pass browser validation and fail the API. Align UI hints/native validation and test boundaries.
2. **Wire types hide nullability/identity differences:** `apps/web/src/types/index.ts:6–13,28,74` describes optional ISBN/metadata as nonnullable strings, phone as a required nonnullable string, and `Genre.id` as string, whereas schema/API permit nullable metadata/phone and integer genre IDs. Align wire types with responses and normalize deliberately into form types. This contributes to I2 but is not separately rated Important without another demonstrated broken workflow.
3. **Contract/document reconciliation:** The initial transcript noted statistics/schema wording drift. Root/API documentation was being corrected concurrently. Reconcile exact endpoint names/shape, access levels and defaults against controllers/shared types at final verification; do not treat historical prose as evidence that a current endpoint is broken.
4. **Deployment verification remains separate:** This review did not build/run containers, install a clean dependency tree, or revalidate lockfile changes being handled by the parent. Local app probes do not prove the image, migration service, or CI succeeds.

## Verification record and limits

Database-free recovery probes were created outside the repository under the session scratch directory:

- `lmbs-review-backend.cjs`: transpiles current source guard/DTO, runs a small Nest/Express app with a stub controller and Supertest; verifies I1, I2 and proxy/bucket evidence for I4.
- `lmbs-review-frontend.mjs`: transpiles current real frontend modules, mocks only browser storage/network, asserts I3 and counts request amplification.

Both corrected probes completed successfully with the outputs above. The first frontend probe attempt stalled because its test URL predicate accidentally matched `/stats/books`; narrowing the probe to the exact collection path resolved that harness error. No production source change was made.

Recovery test runs:

- `npm test`: workspace tests **3/3 passed**; API suites **3 passed / 1 failed**, cases **14 passed / 1 failed**, the failure being the new mixed-case-rate-limit regression. Root command consequently did not proceed to frontend.
- `npm test --workspace=apps/web`: **30 passed / 1 failed**, the failure being the new overlapping-refresh regression.

These red tests were being added by another worker while recovery was in progress. They are evidence that the reported defects were still present at execution time, not a contradiction of the earlier pre-regression green suite. Do not quote the earlier green suite as final post-remediation verification.

The parent supplied earlier real-HTTP/browser acceptance evidence; this reviewer did not rerun or independently certify it. No e2e command was run because the integration suite clears its database. No assertion is made about untested hosted behavior, real concurrency under load, Docker runtime, or final post-fix status. Address I1–I4, add the requested integration/regression coverage, and perform a separate final verification before claiming approval.
