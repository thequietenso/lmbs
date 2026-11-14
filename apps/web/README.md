# Bibliotech LMBS frontend

React/TypeScript/Vite dashboard in the LMBS npm workspace. The existing dark/light interface, responsive navigation, catalog cards, tables and modal workflows are retained; integration does not introduce a new design system.

## Run from the repository root

Install dependencies once at the monorepo root, not independently in this directory:

```sh
npm ci
npm run dev --workspace apps/web
npm test --workspace apps/web
npm run lint --workspace apps/web
npm run build --workspace apps/web
```

Vite normally serves the frontend at `http://localhost:5173`. The API defaults to `http://localhost:3001/api/v1`; see the root installation guide for PostgreSQL, API setup and account provisioning. Production output is `apps/web/dist` and uses hash routes, for example `/#/settings`.

Set a build-time default when needed:

```sh
VITE_API_BASE_URL=/api/v1 npm run build --workspace apps/web
```

A root-relative API URL resolves to the browser's current origin, suitable for the nginx deployment. Absolute HTTP(S) URLs are also supported. Settings can override the default; saved overrides take precedence. Credentials, query strings, fragments, non-HTTP protocols and protocol-relative URLs are rejected. Changing the resolved server URL clears the current authentication session and connected records, including requests that were already in flight.

## Data modes and accounts

**Offline demo** is the default for a new browser session. Its sample books, members, loans and activities form a local sandbox. Changes are saved only under `localStorage.lmbs_demo_v2`; they are never uploaded. Testing server health does not switch modes or turn local operations into persisted server operations.

**Connected catalog** explicitly replaces demo data with all pages of the server catalog and genres. Public browsing does not fetch members, circulation or activities. There is no offline fallback for connected writes.

Open **Settings → Account & Data Mode** to:

- Choose either data mode.
- Sign in with a server account or register a patron account. Registration does not expose a role selector and the client only sends name, email and password.
- View the signed-in identity and role, or sign out.
- Test health and refresh all accessible server records.

Librarians and administrators may manage books and members, issue loans, return books and renew loans. Patron and anonymous connected sessions have disabled management controls and staff-only route notices. The API remains the authorization authority; hiding a control is not a security boundary. Full staff refreshes currently fetch five collections and two statistics endpoints; rapid mutations/realtime echoes can reach the 100-request/minute limit, so large-catalog/refresh optimization remains follow-up work.

Authentication uses a bearer token in `sessionStorage.lmbs_session`, scoped to the exact API base URL. Restored sessions are verified through `/auth/me` before staff data or actions are enabled. Sign-out, 401 responses, mode changes and server changes invalidate pending responses and clear connected datasets. Connected member/loan/activity records are never written into demo storage. Legacy mixed-mode cache keys are discarded instead of being migrated into the sandbox.

## Save and refresh behavior

Forms await the server and keep their contents/error visible if a write fails. Save buttons and fields show a pending state; duplicate concurrent mutations are blocked. Books are sent with all editable catalog fields (genre, inventory, ISBN, shelf, description and cover gradient included); server inventory values are not replaced with invented defaults. Blank ISBN form values are omitted from create/update payloads rather than stored as a shared empty unique value. An empty ISBN edit leaves any existing ISBN unchanged; clearing an existing ISBN is not currently supported. Editing preserves zero values and sends the book version captured when the form opened, allowing the backend to reject stale changes.

After a successful connected mutation, the store refreshes the full authorized snapshot. Empty server collections replace, rather than merge with, old records. If the mutation succeeds but its follow-up refresh fails, the UI reports **saved on server, refresh failed** and blocks further changes until a successful sync. A successful health check alone cannot unlock that stale snapshot. This avoids prompting a duplicate create when only the refresh failed.

Socket.IO connects to the same server origin with the current token in the handshake. Notifications trigger debounced HTTP refreshes; socket payloads never directly mutate records, and the client never sends socket-based CRUD commands. Disconnect status remains visible and manual sync stays available. Logout/mode/server changes disconnect the socket and cancel queued refreshes.

## HTTP contract consumed

All paths below are relative to `/api/v1`:

| Surface | Requests |
| --- | --- |
| Health | `GET /health` |
| Accounts | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Catalog | `GET /books`, `POST /books`, `PUT /books/:id`, `DELETE /books/:id` |
| Genres | `GET /genres` |
| Members | `GET /members`, `POST /members`, `PUT /members/:id`, `DELETE /members/:id` |
| Circulation | `GET /loans`, `POST /loans`, `PUT /loans/:id/return`, `PUT /loans/:id/renew` |
| Activity | `GET /activities` |
| Statistics | `GET /stats/books`, `GET /stats/loans` |

List responses are `{ data, total, page, limit }`. The client requests every page with a limit of 100, checks pagination metadata, and propagates HTTP/validation/network errors. Books use `_id` and a string genre. Members and loans use `id`; loan relations are flattened and circulation dates use `YYYY-MM-DD`. Loan creation sends `{ bookId, memberId, days, notes }`, returns send `{}`, and renewals send `{ days }`. Identity, pagination and statistics types use `@lmbs/shared`.

The API client also supports paginated review reads. Review authoring UI, server-side catalog search, report exports and large-catalog virtualization are outside this frontend integration. CSV/JSON downloads export the currently displayed **catalog only**, not a database backup. CSV values are quoted and spreadsheet formula prefixes are neutralized.

## Implementation and verification

- `src/services/api.ts`: pagination, request timeouts, payloads, safe URL/session handling.
- `src/context/libraryStore.ts`: testable state boundary shared by the React provider, demo persistence, role checks, atomic snapshot replacement and stale-request protection.
- `src/context/LibraryContext.tsx`: React subscription, statistics, notifications, exports and realtime invalidation.
- `src/components/AccountPanel.tsx`: account and explicit mode UI, global session status, staff-access notice.
- Existing views/modals: awaited saves, visible errors and role/pending control states.
- `tests/*.test.mjs`: Node test runner compiles the real TypeScript modules using the existing TypeScript dependency. Tests replace only the network/storage boundaries, not production store actions.

Tests exercise complete pagination, complete book payloads, bearer headers, registration role stripping, relative URL resolution, server changes, JSON/non-JSON 401 cleanup, stale responses, StrictMode session restoration, anonymous/patron authorization, connected member/circulation routes, failed CRUD/circulation without local fallback, separate demo storage, logout, saved-but-refresh-failed reconciliation, inactive demo patrons, repeated returns, and keyboard shortcuts that do not steal a slash typed into a form.

Build runs TypeScript checking before Vite. Lint keeps effect-reset exceptions narrowly documented for the existing always-mounted modals and session boundaries; it does not globally disable hook correctness. Browser checks cover desktop/mobile reflow, explicit connected-mode failure states and disabled unauthorized controls. Full connected end-to-end verification additionally requires the running API and database described in the root guide.
