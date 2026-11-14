# LMBS Monorepo Completion Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans or scoped implementation workers. Follow test-first implementation and final independent review.

**Goal:** Complete the core Bibliotech backend and connect the existing frontend in one history-preserving public monorepo.

**Architecture:** The approved root is `lmbs/`, with npm workspaces `apps/api`, `apps/web`, and `packages/shared`. Preserve the existing backend Git history and publish only a feature branch and PR; rename the existing public repository to `lmbs`. PostgreSQL/Prisma remain authoritative for connected mode; the frontend retains an explicitly labeled standalone demo mode.

**Tech Stack:** Existing NestJS, React/Vite, TypeScript, Prisma 7/PostgreSQL, Socket.IO, npm workspaces.

**Spec:** Root `spec.md` (existing requirements, to be reconciled with verified implementation).

## Approval and constraints

User approved the neutral monorepo, repository rename, public frontend import, backend completion, necessary frontend changes, and documentation cleanup. This plan records the implementation details of that approval; routine code/test choices do not require repeated approval. No merge, force push, destructive hosted database operation, paid service, or automatic hosted migration is authorized. Preserve all original source and uncommitted work in a private backup outside the public tree before restructuring. Do not publish `.env`, generated clients, dependencies, local machine paths, or backups. Hosted database credentials must not be read into tool output.

Scope: core CRUD, circulation, activities, genres, reviews, statistics, health/version, authentication/RBAC, validation/errors/configuration/logging/rate limits, real-time broadcasts, concurrency and optional idempotency, reproducible seeds, Docker/CI definitions, frontend connected mode and documentation. Search/tagging, report exports and mobile applications remain future work. Use API port 3001 to match the actual existing frontend; document this correction to the stale spec.

## Review focus

- Concurrent borrowing/returning must not oversubscribe inventory or increment copies twice.
- Public registration must never choose a privileged role; private member data and real-time payloads require authorization.
- Repeated seeds and retried mutations must not create duplicate records or reset operational circulation state.
- Connected frontend failures must be visible and must not silently claim local-only edits were persisted.
- Migration preserves local work, existing history and unchanged default-branch history until review.

### Task 1: History-preserving monorepo

**Files:** root package.json/package-lock.json/.gitignore; apps/api; apps/web; packages/shared/package.json and src/index.ts.
**Interfaces:** npm workspace commands; shared paginated response and identity contracts.
- [x] Back up both original projects including Git metadata and local-only source, excluding reproducible dependencies/build outputs; record archive verification privately.
- [x] Move existing backend Git metadata to approved root, move backend files to root, and import frontend at apps/web without nested Git metadata. Use `feat/complete-lmbs-monorepo`, preserve main SHA.
- [x] Write a structural test asserting workspace membership and absence of nested Git metadata; observe failure before adding workspace manifests.
- [x] Configure root scripts/lockfile and shared contract package; exercise workspace discovery and builds.
- [x] Rename remote repository, read back exact name/visibility/default branch, and update origin.

### Task 2: Complete and test backend

**Files:** apps/api/src/{books,members,loans,activities,genre,reviews,authentication,realtime,common,config,stats}; Prisma schema/migrations/seed; unit and integration tests.
**Interfaces:** `/api/v1`; paginated lists `{data,total,page,limit}`; books retain `_id` and genre name; members/loans use `id`; flattened loan relations. JWT login/register return `{access_token,user}`; `/auth/me` returns safe identity. Public book/genre reads; staff management; patron self profile/reviews; no self-promotion. Realtime notification-only transport on same HTTP server, authenticated and role-scoped.
- [x] Write failing tests for validation, pagination/filtering, 404/409 errors, inventory transactions/returns/renewals, member deactivation, review uniqueness/ownership, authentication/authorization and configuration.
- [x] Implement actual database-backed modules and transactional audit writes; remove or replace unused generated placeholders.
- [x] Add durable optional idempotency for book/loan creation and stale-book conflict checks; test retries and altered payload conflicts.
- [x] Add non-destructive schema migrations and deterministic seed. Never run against hosted Supabase without explicit approval.
- [x] Verify build, lint, unit and real isolated PostgreSQL integration tests if available; distinguish unavailable infrastructure from passing checks.

### Task 3: Connect frontend

**Files:** apps/web/src/services/api.ts, context/LibraryContext.tsx, authentication UI, settings/navigation and affected forms; packages/shared; frontend tests.
**Consumes:** Task 2 HTTP contract, JWT authorization, pagination, return/renew routes and real-time invalidation.
- [x] Write failing API client/context tests for paginated lists, bearer headers, complete book payloads, errors and session cleanup.
- [x] Add login/logout/register UI and role-aware connected operations while preserving existing visual design.
- [x] Connect books, members, loans, activities and statistics to API; handle failures without false persistence. Keep demo mode clearly distinct.
- [x] Test connected workflows and build/lint. Capture actual running frontend evidence, without private account data.

### Task 4: Reproducible teaching/deployment documentation

**Files:** spec.md, Installation_Guide.md, root README.md, apps/api/README.md, apps/web/README.md, Dockerfile/compose/.dockerignore, .github/workflows/ci.yml.
- [x] Rewrite spec around selected monorepo architecture and actual endpoints, invariants, access policy, scope/status and approval boundaries; remove obsolete alternatives and false completion claims.
- [x] Preserve useful setup explanations in the installation guide; document actual implementation sequence, commands, expected checks and troubleshooting for classroom use.
- [x] Document every supported backend surface in backend README and root overview; do not claim unexecuted hosted/deployment checks passed.
- [x] Add local Postgres/container configuration and bounded public CI without deployment or secrets.
- [x] Exercise documented installation/build/test commands; check public tree for secrets/local paths and accidental generated artifacts.

### Task 5: Review and publish

- [x] Obtain independent whole-branch code review; reproduce important findings with failing tests before fixes.
- [x] Run full quality suite against final committed tree; inspect status and diff; keep main unchanged.
- [ ] Push feature branch, open PR (draft if acceptance remains blocked), and read back PR/head SHA/tree/README to verify publication.
- [ ] Report verified work, remaining acceptance limits, PR URL, and backup location. Journal a concise completion record only inside the user's allowed Hermes/Journal folder.
