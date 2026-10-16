# Prompt Log

Verbatim task prompts and skill invocations from the human engineer (CLAUDE.md §8.7). Append only.

### 2026-10-16 15:56 — Phase 1 — Spec Review

/spec-review docs/drafts/understanding.md docs/drafts/assumptions.md

### 2026-10-16 15:56 — Phase 1 — Spec Record

/spec-record docs/drafts/understanding.md docs/drafts/assumptions.md -- Record the content of docs/drafts/understanding.md and docs/drafts/assumptions.md, plus these locked answers:- Working hours: endTime is computed server-side from ServiceType duration, counting the dealership's working hours only (2h service at 16:00 ends 09:00 next day). Stored as one continuous [startTime, endTime) interval.- Each Dealership stores openTime, closeTime and timezone. Dealerships operate every day; closed days and holidays are next phase.- Technician choice: fewest confirmed appointments overlapping the requested date (dealership local time, each counts as 1); ties broken by fixed order. Bays: fixed order.- Bay and technician must belong to the appointment's dealership.- Bookings with a past startTime are rejected (400).

### 2026-10-16 15:56 — Phase 1 — Spec Record (OQ-1 + overnightConsent)

/spec-record Domain Model, API Contract, Assumptions, Open Questions -- - Resolve OQ-1: the status state machine has Confirmed and Cancelled; the MVP only creates Confirmed; no cancel endpoint. Keep Cancelled..- overnightConsent is an optional boolean, default false. It is checked only when endTime falls on a later local date than startTime; if false, reject (400).

### 2026-10-16 15:56 — Phase 1 — Spec Record (I-11 reword)

/spec-record Invariants -- I-11: overnightConsent is an optional boolean, default false. Only when the computed endTime falls on a later local date than startTime, a value other than true rejects the booking (400). Reword I-11 to match; do not change other invariants.

### 2026-10-16 18:56 — Phase 3 — Scaffold

/scaffold docs/drafts/scaffold-tree.md

### 2026-10-16 18:04 — Phase 2 — ADR

/adr docs/drafts/stack-evaluation.md

### 2026-10-16 19:23 — Phase 3 — Scaffold fix

**Phase**: 3 — Scaffold (fix)
**Task**: Fix the scaffold so typecheck, lint, test and prisma validate all pass. **Scope**: 1. Replace every "*" in package.json with the exact installed version. Pin typescript to the latest 6.0.x (typescript-eslint 8.71.2 supports TS >=4.8.4 <6.1.0). 2. Jest 30: change --testPathPattern to --testPathPatterns in "test" and "test:integration"; add --passWithNoTests to both. 3. Prisma 7: remove url from the datasource in prisma/schema.prisma; add prisma.config.ts at the repo root using defineConfig from 'prisma/config', reading DATABASE_URL via dotenv. 4. Add docker-compose.yml with PostgreSQL pinned to the latest stable major (exact tag, no "latest") and a healthcheck. 5. tsconfig.json: add "include": ["src/**/*", "tests/**/*"]. 6. Record the exact installed versions in the ADR-0001 Decision table (replace "latest stable"). Note that pg and @types/pg come transitively via @prisma/adapter-pg and are not direct dependencies. Out: Do not add pg or @types/pg as direct dependencies. No business logic. Do not change any other file. References: docs/adr/0001-tech-stack.md, CLAUDE.md §6, §8.2. Done when: Show the output of pnpm typecheck, pnpm lint, pnpm test, pnpm test:integration and pnpm prisma validate, all passing. Stop & ask if: Any pinned version conflicts with another package's peer range; or the empty state/ folder is needed by a tool (otherwise list it for me to delete).

### 2026-10-16 17:21 — Phase 2 — Spec Record (Scale assumption)

/spec-record Assumptions -- Replace assumption 5 (Scale) with: Scale [Assumed, not sourced]: ~3–5 million registered vehicles across ~500 dealerships in Vietnam (~20 ServiceBays, ~40 Technicians each). At 2–3 services per vehicle per year, that is ~16,000–41,000 bookings/day. Normal load ~1,000 concurrent users; seasonal or campaign peaks 5,000–10,000. Derived: booking writes average ~1.2/s and peak ~12/s; most concurrent users are reading availability, not writing. Contention is local to one dealership and time window, not global.

### 2026-10-16 22:05 — Phase 3 — Scaffold review fixes (M-5, M-6, M-7)

**Phase**: 3 — Scaffold (review fixes)
**Task**: Fix reviewer findings M-5, M-6, M-7.
**Scope**:
- In:
  1. docker-compose.yml: replace postgres:17-alpine with the exact tag of the latest stable PostgreSQL major (18.x), verified on Docker Hub; update the ADR-0001 version table to match.
  2. package.json: pin @types/node to the latest 24.x to match the Node 24 runtime.
  3. package.json: add "packageManager": "pnpm@<installed version>" and "engines": { "node": ">=24 <25" }.
  4. Keep "lint": "eslint ." but confirm with `pnpm eslint --debug` (or equivalent) that eslint.config.mjs only lints src/ and tests/; report the result.
- Out: No other changes.
**Done when**: Show `pnpm install` and `pnpm verify` output, then delegate to the reviewer subagent and show its verdict.
**Stop & ask if**: @types/node 24.x conflicts with any package's peer range.

### 2026-10-17 02:25 — Phase 4 — Spec Record (frontend, seed, read-only API)

/spec-record Current Phase line, Target Deliverables, Scope Decision, Out of Scope for MVP, API Contract -- 
1. Current Phase: change to "4 — Implement".
2. Target Deliverables [Resolved]: add (a) a booking frontend — one page to book an appointment; (b) a seed script that loads sample master data (dealerships, service bays, technicians with skills, service types, customers, vehicles) so the system can be run and tested.
3. Scope Decision [Resolved]: backend first. Frontend starts only after the backend is complete and `pnpm verify` passes. If time runs out, the backend alone is the submission. Frontend stack will be decided in ADR-0002 at that point.
4. Out of Scope for MVP: remove "frontend" from Non-goals. Add to Next phase: "available time-slot listing". Reason: BRIEF requirement 1 is a request at a desired time, and requirement 2 checks availability before confirming, so availability is checked on booking submission; a slot listing would not remove that check.
5. API Contract [Resolved]: add three read-only operations used by the booking frontend: List Dealerships, List Service Types, List Vehicles of a Customer (by customerId). No create/update/delete for master data. Book Appointment stays as is; on rejection the frontend shows the reason and keeps the form for the customer to pick another time.
