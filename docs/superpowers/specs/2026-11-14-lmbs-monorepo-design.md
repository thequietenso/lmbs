# LMBS Monorepo Completion — Approved Design

## Intent

Finish the existing Bibliotech library backend, integrate the existing React UI, and keep the result understandable and reproducible for classroom teaching. The user approved a neutral `lmbs` repository root, retaining the original backend history, renaming the existing GitHub repository to `lmbs`, keeping its public visibility, and importing the local frontend.

## Approaches considered

1. **Neutral monorepo (selected):** `apps/api`, `apps/web`, `packages/shared`, with root npm workspace commands. Keeps related contract changes in one review and accurately names the whole product.
2. **Separate repositories:** Valid independent release model, but contradicts the requested monorepo and complicates classroom setup and coordinated contract changes.
3. **Frontend inside a repository still named lmbs-backend:** Reuses the existing checkout but misrepresents repository scope. Rejected in favor of renaming, not replacing history.

## Boundaries

- Core backend and frontend integration, authentication, real-time notifications, validation, inventory consistency, tests, documentation, and local deployment configuration are in scope.
- Search/tagging, new report exports, mobile apps, and production deployment are future work, not implied completion requirements.
- Preserve the existing interface instead of redesigning it. Clearly distinguish local demo mode from authoritative connected mode.
- Keep PostgreSQL/Prisma and NestJS; use current installed React/Vite. API port 3001 matches the actual existing frontend rather than stale port-3000 prose.
- Paginated collections use `{data,total,page,limit}`; frontend consumes all requested pages. Shared types live in `packages/shared`.
- Public catalog reads; authenticated staff management; patrons never self-select roles or access other members' private records. Admin bootstrap requires explicit local configuration, never a built-in password.
- Persist loan/book/audit changes atomically; protect stock against concurrent issue/return and retried requests.
- Use same-server authenticated Socket.IO notifications; HTTP remains the mutation transport, avoiding duplicate websocket command validation/authorization paths.

## Documentation responsibilities

Root README explains the complete project. `apps/api/README.md` documents actual backend surfaces. `Installation_Guide.md` provides chronological implementation/setup explanations, reproducible commands, checkpoints, and troubleshooting. Root `spec.md` becomes the selected architecture and current API contract rather than a collection of alternative stacks and unverified completion claims.

## Safety and publication

Create private backups before moving either original project. Preserve the original frontend until imported source is verified; exclude its original nested Git repository from publication. Work only on a feature branch, then publish a PR without merging. No force push, repository deletion, database reset, automatic hosted migration, or spending is authorized. Real integration verification uses a new isolated loopback PostgreSQL cluster, not the existing Supabase configuration. Ask before any new destructive or hosted-database action.

## Builder decisions

Conventional npm workspaces, deterministic demo seed, local PostgreSQL and Docker Compose definitions, unit/component tests plus real HTTP/database smoke tests, and an independent final review. Dependencies and final runtime entry paths are verified against actual execution, not assumed from generated scaffolding.
