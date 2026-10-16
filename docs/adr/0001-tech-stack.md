# ADR-0001 — Tech Stack

**Status**: Accepted

---

## Context

The Unified Service Scheduler MVP must enforce dual-resource allocation (I-1, I-3) with no double-booking under concurrent requests. CLAUDE.md §4.2 defines six weighted criteria; criterion 1 (concurrency guarantee) carries the highest weight and is the primary gate.

The MVP scope is a single operation: `Book Appointment`. Stack complexity must be proportional to that scope.

**Candidates evaluated**:

| Layer | Candidates |
|---|---|
| Framework | NestJS, Fastify, Express |
| Database | PostgreSQL, SQLite |
| ORM | Prisma, TypeORM |

---

## Options

### Database

**PostgreSQL — chosen.**

Two-layer defence against double-booking:

- **Layer 1 — Application-level serialisation under contention**: An interactive transaction at READ COMMITTED issues `SELECT … FOR UPDATE` in a fixed order — Vehicle row first, then Dealership row — before running availability and allocation queries. READ COMMITTED re-snapshots on each statement, so the availability query sees all bookings committed by any concurrent transaction that holds or just released the same locks. Fixed lock order prevents deadlocks (see lock-order reasoning below).

- **Layer 2 — Database-enforced backstop**: `btree_gist` extension with partial `EXCLUDE USING gist` constraints on `tstzrange("startTime", "endTime", '[)') WHERE ("status" = 'Confirmed')` for `("serviceBayId", …)`, `("technicianId", …)`, and `("vehicleId", …)`. `startTime` / `endTime` are `timestamptz` columns, so ranges are UTC-native (I-4). Each constraint has an explicit name (`appointment_bay_no_overlap`, `appointment_technician_no_overlap`, `appointment_vehicle_no_overlap`). Any overlapping `Confirmed` appointment is physically rejected with SQLSTATE `23P01`; the infrastructure adapter maps each constraint name to the corresponding domain exception (409).

**Lock-order deadlock proof (Challenge A)**: Each booking transaction acquires exactly one Vehicle row lock, then exactly one Dealership row lock — always in that order.

- Same vehicle, different dealerships: both transactions compete for the same Vehicle lock. One proceeds; the other blocks. No second lock is acquired until the first is released. No cycle possible.
- Different vehicles, same dealership: both transactions acquire their respective Vehicle locks immediately (no contention), then compete for the same Dealership lock. One proceeds; the other blocks. No cycle possible.
- Deadlock requires two transactions holding a lock the other needs, acquired in opposite order. The fixed Vehicle → Dealership order rules this out in all cases.

**SQLite — rejected.**

SQLite has no row-level locks and no range exclusion constraints. Correctness for I-3 would rest on whole-database write serialisation alone. This neither demonstrates the intended concurrency design nor scales beyond a single writer. SQLite fails criterion 1 (highest weight).

---

### ORM

**Prisma — chosen** (see version policy under Decision).

Prisma does not natively express `EXCLUDE USING gist` constraints in `schema.prisma` or `SELECT … FOR UPDATE` in its fluent API. Both are supported cleanly via escape hatches:

- Custom SQL in a migration file (`prisma migrate dev --create-only`) for `CREATE EXTENSION IF NOT EXISTS btree_gist` and the three named exclusion constraints.
- `prisma.$transaction` with `tx.$queryRaw` (tagged-template form only — see safety rule below) for `SELECT … FOR UPDATE` locking, encapsulated strictly inside `infrastructure/database/` behind application ports.

**`$queryRaw` / `$executeRaw` safety rule**: only the tagged-template form is permitted. `$queryRawUnsafe` and `$executeRawUnsafe` are forbidden across the entire codebase.

**TypeORM — not chosen.** Prisma's type generation, migration tooling, and escape hatches are sufficient. TypeORM was not evaluated in detail because Prisma meets all criteria without it.

---

### Framework

**NestJS — chosen.**

- Mature DI container and modular structure.
- Global `ExceptionFilter` maps domain exceptions to HTTP 400 / 404 / 409 / 422 per CLAUDE.md §7.
- Use cases and domain services are plain TypeScript classes, wired in the NestJS module layer via `useFactory` providers and injection tokens. `domain/` and `application/` contain zero NestJS imports (`@Injectable`, `@Module`, etc.).
- Prisma-generated types do not cross the `infrastructure/` boundary; repositories map them to domain types.

**Fastify / Express — not chosen.** Both are viable but require manual wiring of DI, error mapping, and validation. NestJS removes that boilerplate for no architectural cost given the layer-isolation approach above.

---

## Decision

**Chosen stack: NestJS + PostgreSQL + Prisma ORM.**

**Version policy**: Use the latest stable release of every dependency as of Phase 3 scaffold, verified against official docs. No pre-releases; no floating `latest` image tags. Exact versions are pinned in `pnpm-lock.yaml` and Docker image tags and recorded in this ADR when Phase 3 starts.

**Current expectation** (to be confirmed at Phase 3):

| Dependency / Tool | Expected version / Role |
|---|---|
| Package manager | `pnpm` — latest stable |
| Node.js | current LTS |
| TypeScript | latest stable — `strict: true` |
| NestJS (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `@nestjs/cli`) | latest stable |
| Validation (`class-validator`, `class-transformer`) | latest stable — used only in `presentation/dtos/` via NestJS `ValidationPipe` |
| Prisma ORM (`prisma`, `@prisma/client`) | 7.x — default `prisma-client` generator, `moduleFormat = "cjs"` to match NestJS CommonJS build |
| `@prisma/adapter-pg` | latest stable — required by Prisma 7 driver adapter model (approved). Whether `pg` must also be a direct dependency is verified against Prisma docs at Phase 3 |
| `dotenv` | latest stable — loads `DATABASE_URL` for Prisma 7 config, as in the NestJS Prisma recipe |
| PostgreSQL image | latest stable major — exact tag pinned in `docker-compose.yml` (replacing `postgres:16-alpine` from evaluation draft) |
| Test stack (`jest`, `ts-jest`, `@types/jest`, `@nestjs/testing`, `supertest`, `@types/supertest`) | latest stable |
| Linter (`eslint`, `typescript-eslint`) | latest stable — enforces `@typescript-eslint/no-explicit-any: error` |

---

## Consequences

### Positive

- PostgreSQL Layer 2 (`EXCLUDE USING gist`) physically enforces I-3 regardless of application bugs; correctness does not rest on application logic alone.
- Fixed lock order (Vehicle → Dealership) eliminates the deadlock class described in Challenge A without optimistic-retry complexity.
- NestJS `useFactory` wiring keeps `domain/` and `application/` 100% framework-free; the architecture satisfies CLAUDE.md §7 layer boundary rules.
- `docker compose up --build` brings up the full stack (DB + migrations + seed + API); reviewer setup requires only Docker.

### Negative / Trade-offs accepted

1. **Docker required for integration tests.** PostgreSQL cannot run without Docker (or an external instance). SQLite zero-config was traded for the concurrency guarantee (criterion 1 over criterion 4).

2. **Raw SQL in one migration file.** `EXCLUDE USING gist` constraints are not expressible in `schema.prisma`; they are added via a custom migration SQL file. Prisma schema introspection will not reflect these constraints. Trade-off: raw SQL in exactly one place in exchange for Prisma's type generation and migration workflow (criterion 6 and ORM ergonomics over 100% native DDL in criterion 2).

3. **`$queryRaw` tagged-template usage.** `SELECT … FOR UPDATE` is issued via `tx.$queryRaw` (tagged-template form), not the fluent API. Encapsulated in `infrastructure/database/` only. `$queryRawUnsafe` / `$executeRawUnsafe` are banned across the codebase.

4. **`@prisma/adapter-pg` dependency.** Prisma 7 requires a driver adapter. `@prisma/adapter-pg` is approved; it will be added at Phase 3 scaffold (`pnpm add @prisma/adapter-pg`).

5. **ESM/CJS interop pinned at Phase 3.** Prisma 7 with `moduleFormat = "cjs"` is expected to match NestJS's CommonJS build. Exact compatibility is confirmed at Phase 3 when versions are pinned; any interop issue is resolved before scaffold is considered complete.

### Testability

- **Layer 1 concurrency test**: NestJS app boots in-process; `supertest` + `Promise.all` fires N parallel HTTP booking requests for the same slot. Seed data leaves exactly one free resource (bay or technician) for that slot. Assertion: exactly 1 succeeds (201), N−1 fail (409). **Precondition**: Prisma connection pool size ≥ N for the test run.
- **Layer 2 backstop test**: bypasses application logic; inserts two overlapping `Confirmed` appointments directly via raw SQL and asserts the database rejects the second with SQLSTATE `23P01`.

### Redis (considered, not included)

Redis locks would add a second source of truth without replacing the PostgreSQL guarantee. Peak write load is ~12 bookings/s with contention local to one dealership, which a single PostgreSQL instance handles. In the MVP the availability check runs inside the booking write transaction on the primary (after `SELECT … FOR UPDATE`), so a read replica or cache cannot serve it. Revisit only if a future read-only slot-browsing endpoint exceeds latency targets after indexing and read replicas, or when per-vehicle rate limiting is built across multiple API instances.
