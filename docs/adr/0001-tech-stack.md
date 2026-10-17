# ADR-0001 — Tech Stack

**Status**: Accepted

**Amended**: 2026-10-17 — Layer 1 first lock changed from the Vehicle row to a plate advisory lock, so concurrent first bookings for the same new plate are serialised (DESIGN.md, Customer and vehicle resolution).

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

- **Layer 1 — Application-level serialisation under contention**: An interactive transaction at READ COMMITTED acquires two locks in a fixed order before running resolution, availability, and allocation queries: first a transaction-scoped advisory lock on the normalized license plate (`pg_advisory_xact_lock(<bigint key>)`, where the key is a stable 64-bit hash of the normalized plate computed in the infrastructure adapter), then the Dealership row via `SELECT … FOR UPDATE`. The plate lock works whether or not the vehicle row exists yet, so concurrent first bookings for the same new plate run one after the other: the second sees the committed customer and vehicle, or nothing if the first rolled back. READ COMMITTED re-snapshots on each statement, so the queries see all bookings committed by any concurrent transaction that holds or just released the same locks. Fixed lock order prevents deadlocks (see lock-order reasoning below). The unique constraint on the normalized `licensePlate` stays as a backstop; a 23505 on it indicates a Layer 1 bug.

- **Layer 2 — Database-enforced backstop**: `btree_gist` extension with partial `EXCLUDE USING gist` constraints on `tstzrange("startTime", "endTime", '[)') WHERE ("status" = 'Confirmed')` for `("serviceBayId", …)`, `("technicianId", …)`, and `("vehicleId", …)`. `startTime` / `endTime` are `timestamptz` columns, so ranges are UTC-native (I-4). Each constraint has an explicit name (`appointment_bay_no_overlap`, `appointment_technician_no_overlap`, `appointment_vehicle_no_overlap`). Any overlapping `Confirmed` appointment is physically rejected with SQLSTATE `23P01`; the infrastructure adapter maps each constraint name to the corresponding domain exception (409).

**Lock-order deadlock proof (Challenge A)**: Each booking transaction acquires exactly one plate advisory lock, then exactly one Dealership row lock — always in that order. Both are released at commit or rollback.

- Same plate (new or existing), different dealerships: both transactions compete for the same plate lock. One proceeds; the other blocks. No second lock is acquired until the first is released. No cycle possible.
- Different plates, same dealership: both transactions acquire their respective plate locks immediately (no contention), then compete for the same Dealership lock. One proceeds; the other blocks. No cycle possible.
- Hash collision between two different plates: those transactions are serialised as if they shared a plate. This costs throughput only, never correctness, and cannot create a cycle because the order is unchanged.
- Deadlock requires two transactions holding a lock the other needs, acquired in opposite order. The fixed plate → Dealership order rules this out in all cases.

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

**Pinned versions** (Phase 3 scaffold — 2026-10-16):

| Dependency / Tool | Pinned version |
|---|---|
| Package manager | pnpm 11.13.1 |
| Node.js | 24.18.0 (current LTS) |
| TypeScript | 6.0.3 — pinned to `<6.1.0` due to `typescript-eslint@8.71.2` peer constraint (`>=4.8.4 <6.1.0`); `strict: true` |
| NestJS (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `@nestjs/testing`) | 12.1.3 |
| NestJS CLI / Schematics (`@nestjs/cli`, `@nestjs/schematics`) | 12.0.8 / 12.0.7 |
| Validation (`class-validator`, `class-transformer`) | 0.15.1 / 0.5.1 — used only in `presentation/dtos/` via NestJS `ValidationPipe` |
| Prisma ORM (`prisma`, `@prisma/client`) | 7.10.0 — `prisma-client` generator, `moduleFormat = "cjs"`; datasource URL provided via `prisma.config.ts` (not `schema.prisma`) |
| `@prisma/adapter-pg` | 7.10.0 — `pg` and `@types/pg` come transitively; not direct dependencies |
| `dotenv` | 18.0.8 — loaded via `import 'dotenv/config'` in `prisma.config.ts` |
| PostgreSQL image | `postgres:18.6-alpine3.24` — pinned in `docker-compose.yml` |
| Jest / ts-jest | 30.5.2 / 29.4.15 |
| `@types/jest`, `@types/node`, `@types/supertest` | 30.0.0 / 24.19.2 / 7.2.1 |
| supertest | 7.3.1 |
| ESLint / typescript-eslint | 10.12.0 / 8.71.2 — enforces `@typescript-eslint/no-explicit-any: error` |

---

## Consequences

### Positive

- PostgreSQL Layer 2 (`EXCLUDE USING gist`) physically enforces I-3 regardless of application bugs; correctness does not rest on application logic alone.
- Fixed lock order (plate advisory lock → Dealership row) eliminates the deadlock class described in Challenge A without optimistic-retry complexity, and covers vehicles that do not exist yet.
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
