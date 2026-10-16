**Candidates considered**:
- Framework: NestJS vs. Fastify vs. Express
- Database: PostgreSQL vs. SQLite
- ORM: Prisma vs. TypeORM

**My preferred choice**: NestJS + PostgreSQL + Prisma

**Evaluation against criteria**:
1. Concurrency guarantee (highest weight):
   PostgreSQL provides a two-layer defense against double-booking across ServiceBay (I-1, I-3), Technician (I-1, I-3), and Vehicle (I-10):
   - Layer 1 (Coordination under contention): Inside an interactive transaction at READ COMMITTED (PostgreSQL default), lock rows with `SELECT ... FOR UPDATE` in a fixed order — first the target Vehicle row (for cross-dealership I-10), then the target Dealership row — before running the availability and workload-allocation query. The fixed lock order prevents deadlocks. Because READ COMMITTED takes a new snapshot per statement, the availability query that runs after the locks are acquired sees every booking committed by the previous transaction. This serializes concurrent requests targeting the same dealership or vehicle so that when 2 bays/technicians are free, two concurrent requests deterministically get assigned different resources instead of colliding on the same first candidate.
   - Layer 2 (Hard database integrity backstop): PostgreSQL `btree_gist` extension with partial `EXCLUDE USING gist` constraints on `tstzrange("startTime", "endTime", '[)') WHERE ("status" = 'Confirmed')` for `("serviceBayId", ...)`, `("technicianId", ...)`, and `("vehicleId", ...)`. `startTime` and `endTime` are `timestamptz` columns (`@db.Timestamptz(3)` in Prisma) so the range is built in UTC without casts (I-4). Each constraint has an explicit name (e.g. `appointment_bay_no_overlap`, `appointment_technician_no_overlap`, `appointment_vehicle_no_overlap`). Even if application code had a bug, the database physically rejects any overlapping active appointment with SQLSTATE `23P01` (`exclusion_violation`); the infrastructure adapter maps the violated constraint name to `BayUnavailableException`, `TechnicianUnavailableException`, or the vehicle-conflict exception (all 409).
   (SQLite was rejected because it has no row-level locks or range exclusion constraints, so there is no database-level backstop for I-3; correctness would rest on whole-database write serialization alone, which does not demonstrate or scale the intended concurrency design.)

2. ORM support for (1):
   Prisma does not natively express `btree_gist` exclusion constraints in `schema.prisma` or `SELECT ... FOR UPDATE` in its fluent API. However, Prisma supports both cleanly via escape hatches:
   - Custom SQL in a migration file (`prisma migrate dev --create-only`) to add `CREATE EXTENSION IF NOT EXISTS btree_gist` and the three named `EXCLUDE USING gist` constraints.
   - Interactive transactions (`prisma.$transaction`) combined with `tx.$queryRaw` for `SELECT ... FOR UPDATE` locking, encapsulated strictly inside `infrastructure/database/` behind application ports.

3. Testability:
   Full support for real-database concurrency integration tests using a local PostgreSQL container via `docker compose` and a PostgreSQL service container in GitHub Actions CI:
   - Layer 1 test: `Promise.all` firing N parallel booking requests for the same slot, with seed data that leaves exactly one free bay (or exactly one free qualified technician) for that slot, and verifying exactly 1 succeeds and N-1 fail with 409.
   - Layer 2 test: bypass Layer 1 and insert two overlapping `Confirmed` appointments directly, verifying the database rejects the second with `23P01`.

4. Reviewer setup cost:
   Containerized end-to-end with Docker (`Dockerfile` + `docker-compose.yml` with `postgres:16-alpine` healthchecks, automatic Prisma migration deployment, and seed data). A reviewer only needs Docker installed and can bring up the entire stack (DB + schema + seed data + NestJS API server) with a single command (`docker compose up --build`). Running the tests locally (`docker compose up -d postgres && pnpm test`) additionally requires Node.js and pnpm.

5. Architecture fit:
   NestJS provides a mature DI container, modular structure, and global Exception Filters (ideal for mapping Domain Exceptions to HTTP 400/404/409/422 per CLAUDE.md §7). To strictly obey CLAUDE.md §7 (`domain/` and `application/` must NOT import framework decorators like `@Injectable()`), use cases and domain services will remain pure TypeScript classes wired in the NestJS module layer via `useFactory` providers and injection tokens. Prisma-generated types do not leave `infrastructure/`; repositories map them to domain types.

6. Delivery time:
   Fits well within the assessment timebox. Only one operation (`Book Appointment`) is in MVP scope; NestJS + Prisma removes boilerplate for HTTP routing, DTO validation, transaction management, and schema migrations.

**Trade-offs I accept**:
1. **Concurrency guarantee (Criterion 1) over Reviewer setup cost (Criterion 4)**: I accept requiring Docker for PostgreSQL instead of zero-config SQLite because Concurrency Guarantee has the highest weight and PostgreSQL provides true row-level locking (`FOR UPDATE`) and database-enforced range exclusion (`EXCLUDE USING gist`).
2. **Delivery time & Type-safe CRUD (Criterion 6) over 100% native ORM DDL (Criterion 2)**: I accept writing raw SQL in one Prisma migration file for `EXCLUDE USING gist` and using `$queryRaw` for `SELECT ... FOR UPDATE` inside the infrastructure adapter, in exchange for Prisma's strong type generation and fast migration workflow.
3. **Structured DI & Error mapping (Criterion 5) over Framework minimalism**: I accept NestJS's heavier footprint compared to Express/Fastify, and I accept wiring use cases via `useFactory` providers so that `domain/` and `application/` stay 100% free of NestJS imports.

**Options considered and rejected**:
  - **Redis — considered, rejected for MVP.** Double-booking must be enforced by the database (I-3); a Redis lock would add a second source of truth without removing the DB guarantee. Peak write load is ~12 bookings/s with contention local to one dealership, which a single PostgreSQL handles. Revisit if load testing at peak CCU shows availability reads exceed the latency target after indexing and a read replica, or when per-vehicle rate limiting is built across multiple API instances.
