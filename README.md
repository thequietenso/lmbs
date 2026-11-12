# 📚 Bibliotech LMBS — Backend

> **Backend API** for the Bibliotech Library Management System (LMBS) — built with **NestJS**, **Prisma**, **PostgreSQL** (Supabase), and **TypeScript**.

A production-ready REST API for managing library operations: catalog, circulation, members, audit activity, and reviews. This is the backend companion to the `lmbs-ui` frontend.

**Maintained by:** [` hersaintel`](https://github.com/hersaintel)

---

## 📑 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Project Structure](#project-structure)
4. [Prerequisites](#prerequisites)
5. [Getting Started](#getting-started)
6. [Database Schema](#database-schema)
7. [API Reference](#api-reference)
8. [Configuration](#configuration)
9. [Scripts](#scripts)
10. [Testing Strategy](#testing-strategy)
11. [Deployment](#deployment)
12. [Limitations & Future Work](#limitations--future-work)
13. [License](#license)

---

## Overview

The Backend API is the **data layer** for the Bibliotech Library Management System (LMBS). It provides a **RESTful interface** to a PostgreSQL database hosted on **Supabase**, handling:

- **Book cataloging** — titles, authors, ISBN, genre, copies, shelf location, description, cover gradient
- **Member management** — patrons and librarians, membership numbers, status, contact info, bio, hobbies
- **Circulation** — loans, borrow/return, overdue tracking, fine amounts
- **Audit activity** — log of every system action: borrow, return, add book, add member, sync
- **Reviews** — ratings + comments on books, one review per user per book

### Why This Architecture?

| Decision | Why |
|---|---|
| **NestJS** | TypeScript-first, modular architecture, dependency injection (DI) built-in, validation pipes, clear separation of concerns. Scales well from learning to production. |
| **Prisma** | Type-safe ORM, auto-generated client, migration support, and its own type generation (`generated/prisma/client`). The `prisma7.config.ts` uses Prisma 7's new config format. |
| **PostgreSQL + Supabase** | Reliable, managed PostgreSQL with connection pooling. Supabase provides a hosted Postgres instance, SSL by default, and a generous free tier. |
| **Prisma 7 (`prisma7.config.ts`)** | Prisma 7's new config format separates schema, migration, and seed configuration using `defineConfig` and `env()` for type-safe environment variable access. |
| **Monorepo layout** | Single repository with `apps/api/` and `packages/shared/`. Keeps frontend and backend together, sharing configuration and scripts. |

---

## Project Structure (Source)

```text
apps/api/
├── prisma/
│   ├── schema.prisma              # Data models (Genre, Book, Member, Loan, Activity, Review)
│   ├── seed.ts                     # Seed script — populates demo data (10 genres, 10 books, 5 members, 6 loans, 5 activities)
│   ├── migrations/                 # Prisma migrations (versioned, timestamped)
│   │   ├── 20261111085449_init/
│   │   │   └── migration.sql
│   │   ├── 20261111100720_init/
│   │   │   └── migration.sql
│   │   └── migration_lock.toml
│   └── seed.config.ts              # Prisma 7 seed command config
├── src/
│   ├── prisma/
│   │   ├── prisma.module.ts        # Prisma module — global, exports PrismaService
│   │   └── prisma.service.ts       # Prisma client service — dependency injection
│   ├── books/                      # Book management module
│   │   ├── books.controller.ts
│   │   ├── books.service.ts
│   │   ├── books.module.ts
│   │   ├── books.controller.spec.ts
│   │   ├── books.service.spec.ts
│   │   └── dto/
│   │       ├── create-book.dto.ts
│   │       └── update-book.dto.ts
│   ├── members/                    # Member management module
│   ├── loans/                      # Loan/cancellation module
│   ├── activities/                 # Audit log module
│   ├── review/                     # Book review module
│   ├── genre/                      # Genre management module
│   ├── app.module.ts               # Root module — imports all submodules
│   ├── main.ts                     # Bootstrap — app.listen() on port 3000
│   └── prisma.service.ts           # Prisma client service
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── prisma7.config.ts               # Prisma 7 config (schema, migrations, seed)
└── .env.example                    # Environment template (copy to .env)
```

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | `^20.19.0 || >=22.12.0` | LTS recommended |
| npm | Comes with Node.js | Package manager |
| Supabase account | Free tier sufficient | Managed PostgreSQL |

---

## Getting Started

### 1. Clone and navigate

```bash
cd lmbs-backend/apps/api
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure the database

```bash
cp .env.example .env
# Edit .env and paste your real Supabase connection string:
# DATABASE_URL="postgresql://postgres:<password>@<project-ref>.supabase.co:5432/postgres?sslmode=require"
```

### 4. Generate the Prisma client

```bash
npx prisma generate --config prisma7.config.ts
```

### 5. Run migrations

```bash
npx prisma migrate dev --name init --config prisma7.config.ts
```

### 6. Seed the database

```bash
npx prisma db seed --config prisma7.config.ts
```

This populates the database with:
- **10 genres** (Computer Science, Software Engineering, Science Fiction, etc.)
- **10 books** (classic computer science & literature titles)
- **5 members** (Alexander Wright, Elena Rostova, Marcus Chen, Sophia Patel, Devon Vance)
- **6 loans** (2 active, 2 overdue, 1 returned, 1 pending)
- **5 activities** (borrow, return, add_book, add_member events)

### 7. Start the development server

```bash
npm run start:dev
```

The API will be available at `http://localhost:3000/api/v1`.

---

## Database Schema

### Entity Relationship Diagram

```
┌────────────┐       ┌────────────┐       ┌────────────┐
│   Genre    │───────│   Book     │───────│   Loan     │
│  id Int    │──┐    │  id String │ ─┐   │  id String │
│  name      │  │    │  title     │  │   │  bookId    │ ─┐
│  slug      │──┘    │  author    │  │   │  memberId  │ ─┤
│  books     │◄──┐  │  isbn      │  │   │  status    │ ─┤
│  description│     │  genreId──┐ │  │   │  dueDate    │
│  createdAt  │     │  copies    │  │   │  returnDate │
└────────────┘     │  shelfLoc  │  │   └────────────┘
                   │  description│  │
                   │  coverGrad  │  │
                   │  createdAt  │  │
                   └────────────┘  │
    ┌────────────┐                │
    │   Member   │────────────────┘
    │  id String │──────────────────┐
    │  name      │                  │
    │  email     │                  │
    │  phone     │                  │
    │  membership│                  │
    │  status    │                  │
    │  joinedDate│                  │
    │  loans     │────────┐         │
    │  reviews   │        │         │
    └────────────┘        │         │
             ┌────────────┴──┐     │
             │   Review      │     │
             │  id String    │     │
             │  rating Int   │     │
             │  comment      │     │
             │  bookId       │     │
             │  userId       │     │
             └────────────┘     │
```

### Model Summary

| Model | Primary Key | Unique Fields | Key Relationships | Notes |
|---|---|---|---|---|
| `Genre` | `id Int` | `name`, `slug` | → `Book` (one-to-many) | Catalog categories |
| `Book` | `id String` (cuid) | `isbn` | → `Genre` (many-to-one), → `Loan`, → `Review` | Physical books |
| `Member` | `id String` (cuid) | `email`, `membershipNumber` | → `Loan`, → `Review` | Patrons + librarians |
| `Loan` | `id String` (cuid) | — | → `Book`, → `Member` | Borrow/return tracking |
| `Activity` | `id String` (cuid) | — | — | Audit log |
| `Review` | `id String` (cuid) | — | → `Book`, → `Member` | Ratings + comments |

### Key Design Decisions

| Decision | Trade-off | Why |
|---|---|---|
| `Book.genreId` (Int) → `Genre.id` (Int) | Requires join on query | Avoids data duplication — many books share the same genre |
| `Member.status` (String, default `"active"`) | Enum-like but string | Simple, no migration risk for enum changes |
| `Loan.returnDate` (DateTime?, optional) | Nullable field | Distinguishes active vs returned loans |
| `Review.bookId + userId` (`@@unique`) | Composite unique constraint | Ensures one review per user per book |
| `Activity.timestamp` (DateTime, default `now()`) | Auto-set | Audit log always records time of action |

---

## API Reference

### Base URL

```
http://localhost:3000/api/v1
```

---

### Books

| Method | Route | Description | Request Body | Response |
|---|---|---|---|---|
| `GET` | `/api/v1/books` | List all books | — | `Book[]` |
| `POST` | `/api/v1/books` | Create a book | `{ title, author, genreId, copies?, pages?, publishedYear?, shelfLocation?, description?, coverGradient? }` | `Book` |
| `GET` | `/api/v1/books/:id` | Get a single book | — | `Book` |
| `PUT` | `/api/v1/books/:id` | Update a book | `{ title?, author?, genreId?, copies?, pages?, publishedYear?, shelfLocation?, description?, coverGradient? }` | `Book` |
| `DELETE` | `/api/v1/books/:id` | Delete a book | — | `200 OK` |

**Book Response Shape:**

```json
{
  "_id": "book-1794401371643-5eh50d2z",
  "title": "Atomic Habits",
  "author": "James Clear",
  "genreId": 7,
  "genre": "Self Improvement",
  "pages": 320,
  "publishedYear": 2018,
  "isbn": "978-1794401371643-5eh50d2z",
  "totalCopies": 3,
  "availableCopies": 3,
  "shelfLocation": "Self Improvement - A1",
  "description": "A practical framework for building good habits.",
  "coverGradient": "linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)",
  "createdAt": "2026-11-11T12:49:32.353Z",
  "updatedAt": "2026-11-11T12:49:32.353Z"
}
```

---

### Members

| Method | Route | Description | Request Body | Response |
|---|---|---|---|---|
| `GET` | `/api/v1/members` | List all members | — | `Member[]` |
| `POST` | `/api/v1/members` | Register a member | `{ name, email, phone?, membershipNumber?, status?, bio?, hobbies? }` | `Member` |
| `GET` | `/api/v1/members/:id` | Get a member | — | `Member` |
| `PUT` | `/api/v1/members/:id` | Update a member | `{ name?, email?, phone?, membershipNumber?, status?, bio?, hobbies? }` | `Member` |
| `DELETE` | `/api/v1/members/:id` | Delete a member | — | `200 OK` |

**Member Response Shape:**

```json
{
  "_id": "mem-001",
  "name": "Alexander Wright",
  "email": "alex.wright@university.edu",
  "phone": "+1 (555) 234-8901",
  "membershipNumber": "LIB-2024-001",
  "status": "active",
  "joinedDate": "2026-11-10T12:00:00.000Z",
  "bio": "Senior researcher in Distributed Systems.",
  "hobbies": "Reading, hiking"
}
```

---

### Loans

| Method | Route | Description | Request Body | Response |
|---|---|---|---|---|
| `GET` | `/api/v1/loans` | List all loans | — | `Loan[]` |
| `POST` | `/api/v1/loans` | Issue a loan | `{ bookId, memberId, dueDate }` | `Loan` |
| `GET` | `/api/v1/loans/:id` | Get a loan | — | `Loan` |
| `PUT` | `/api/v1/loans/:id` | Update a loan (return/renew/fine) | `{ status?, returnDate?, fineAmount?, notes? }` | `Loan` |
| `DELETE` | `/api/v1/loans/:id` | Delete a loan | — | `200 OK` |

**Loan Response Shape:**

```json
{
  "_id": "loan-201",
  "bookId": "book-1794401371643-g0kpi8m2",
  "bookTitle": "Designing Data-Intensive Applications",
  "bookAuthor": "Martin Kleppmann",
  "memberId": "mem-001",
  "memberName": "Alexander Wright",
  "memberEmail": "alex.wright@university.edu",
  "borrowDate": "2026-11-01",
  "dueDate": "2026-11-15",
  "returnDate": null,
  "status": "active",
  "fineAmount": 0,
  "notes": "Renewed once for thesis research"
}
```

---

### Activities (Audit Log)

| Method | Route | Description | Response |
|---|---|---|---|
| `GET` | `/api/v1/activities` | List activity log | `Activity[]` |
| `POST` | `/api/v1/activities` | Create an activity entry | `Activity` |
| `GET` | `/api/v1/activities/:id` | Get a single activity | `Activity` |
| `DELETE` | `/api/v1/activities/:id` | Delete an activity | `200 OK` |

**Activity Response Shape:**

```json
{
  "_id": "act-1",
  "type": "borrow",
  "title": "Book Checked Out",
  "description": "Alexander Wright borrowed \"Designing Data-Intensive Applications\"",
  "timestamp": "2026-11-11T12:50:00.000Z",
  "createdAt": "2026-11-11T12:50:00.000Z"
}
```

---

### Reviews

| Method | Route | Description | Response |
|---|---|---|---|
| `GET` | `/api/v1/reviews` | List all reviews | `Review[]` |
| `POST` | `/api/v1/reviews` | Add a review | `Review` |
| `GET` | `/api/v1/reviews/:id` | Get a review | `Review` |
| `PUT` | `/api/v1/reviews/:id` | Update a review | `Review` |
| `DELETE` | `/api/v1/reviews/:id` | Delete a review | `200 OK` |

**Review Response Shape:**

```json
{
  "_id": "rev-1",
  "rating": 5,
  "comment": "Excellent book for system design.",
  "bookId": "book-1794401371643-g0kpi8m2",
  "userId": "mem-001",
  "createdAt": "2026-11-11T12:51:00.000Z",
  "updatedAt": "2026-11-11T12:51:00.000Z"
}
```

---

## Configuration

### Environment Variables (`.env`)

```bash
# Supabase PostgreSQL connection string
# IMPORTANT: Use ?sslmode=require for secure connection
DATABASE_URL="postgresql://postgres:<password>@<project-ref>.supabase.co:5432/postgres?sslmode=require"

# Port (optional — defaults to 3000)
PORT=3000
```

> ⚠️ **Never commit `.env` to version control.** The `.env.example` file shows the template with placeholders.

### Prisma Configuration (`prisma7.config.ts`)

```typescript
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "ts-node prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run start:dev` | Start NestJS dev server with HMR (port 3000) |
| `npm run build` | Build the production bundle |
| `npm run lint` | Run oxlint (type-aware linting) |
| `npm run test` | Run unit tests (Jest) |
| `npm run test:e2e` | Run e2e tests (Jest) |
| `npm run test:cov` | Run tests with coverage |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Create and run a new migration |
| `npm run prisma:seed` | Run seed script (generate client + seed) |

---

## Testing Strategy

> **Note:** Unit and e2e tests exist in the repository (`*.spec.ts` files) but are not yet fully implemented. This is a known limitation.

### Current Test Coverage

| Test Type | Command | Status |
|---|---|---|
| Unit tests | `npm run test` | ⚠️ Partial — some specs exist, not all |
| E2E tests | `npm run test:e2e` | ⚠️ Partial — test suite exists but not complete |
| Test coverage | `npm run test:cov` | ⚠️ Generate coverage report |

### Testing Approach

The project uses **Jest** as the test runner with:

- **Unit tests** (`*.spec.ts`) — Test individual service and controller methods in isolation
- **E2E tests** (`test/app.e2e-spec.ts`) — Test full request/response flow through the NestJS app
- **Test coverage** — Jest `--coverage` flag for branch and line coverage

### Testing Philosophy

This is a **learning project**, so the testing strategy is:

1. **Understand the codebase** — Read existing tests to learn the patterns
2. **Test the happy path** — Verify that known working features behave correctly
3. **Test edge cases later** — Error handling, validation, and boundary conditions after core functionality is stable
4. **Mock external dependencies** — Prisma client calls, database connections, and HTTP requests should be mocked

### Recommended Test Priority Order

| Priority | What to Test | Approach |
|---|---|---|
| 1 (High) | Core CRUD (create, read, update, delete) for Books | Unit tests on `BooksService` |
| 2 (High) | Loan lifecycle (issue, return, overdue) | Unit + integration tests |
| 3 (Medium) | Member registration and status enforcement | Unit tests |
| 4 (Medium) | Activity log recording | Unit tests |
| 5 (Low) | Review creation and uniqueness constraint | Unit tests |
| 6 (Low) | End-to-end API flows | `test/app.e2e-spec.ts` |

### How to Run Tests

```bash
# Run all tests
npm run test

# Run a specific test file
npx jest src/books/books.service.spec.ts

# Run tests in watch mode (during development)
npm run test:watch

# Generate coverage report
npm run test:cov
```

### Testing Checklist

- [ ] **Book CRUD** — create, read, update, delete
- [ ] **Book validation** — required fields, unique ISBN
- [ ] **Loan lifecycle** — issue, return, overdue
- [ ] **Member validation** — unique email, membership number
- [ ] **Activity logging** — all system actions recorded
- [ ] **Review uniqueness** — one review per user per book
- [ ] **Authorization** — (future) role-based access control
- [ ] **Integration** — database connectivity, Prisma client

---

## Deployment

### Deploy to Supabase (PostgreSQL)

1. Create a project at [supabase.com](https://supabase.com)
2. Get your connection string: `DATABASE_URL`
3. Run migrations:
   ```bash
   npx prisma migrate deploy --config prisma7.config.ts
   ```
4. Set the `DATABASE_URL` environment variable in your deployment platform

### Deploy the Backend (Node.js + NestJS)

| Platform | Command |
|---|---|
| Railway | `railway deploy` |
| Render | `render create --type web` |
| Fly.io | `fly launch` |
| Heroku | `heroku create && git push heroku main` |
| AWS | Use AWS CDK, SAM, or Elastic Beanstalk |

### Docker (Optional)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm install --production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "dist/main"]
```

---

## Limitations & Future Work

> ⚠️ **Note:** This is a learning project. The following are known gaps that need to be addressed before production deployment:

1. **No authentication or authorization.** No JWT, no guards, no role-based access control. The API is stateless and accepts any request.
2. **No input validation** beyond NestJS `ValidationPipe` defaults. DTOs need full validation decorators (`@IsString()`, `@IsEmail()`, `@Min()`, `@Max()`).
3. **No pagination** for list endpoints (`GET /books`, `GET /members`, `GET /loans` return all records).
4. **No soft delete.** `DELETE /books/:id` permanently removes records.
5. **No audit logging** for the `Activity` model. Activities are only created in the seed script, not through the API.
6. **No real-time updates.** REST-only, no WebSocket or SSE subscription.
7. **No testing.** Unit and e2e tests exist but are not fully implemented.
8. **No CI/CD pipeline.** No automated tests or deployment pipeline.
9. **No Docker.** No containerization for local or cloud deployment.
10. **No frontend API sync for members and loans.** The frontend syncs books only via `syncWithBackend()`.

---

## License

© Power Learn Project (PLP) / #1MillionDevs4Africa. Learning project — for educational use.

---


