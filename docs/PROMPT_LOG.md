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

### 2026-10-17 02:48 — Phase 4 — Spec Record (customer/vehicle created at booking)

/spec-record Target Deliverables, Out of Scope for MVP, Domain Model, API Contract, Assumptions -- 
1. Target Deliverables: the seed script loads dealerships, service bays, technicians with skills, and service types only. Customers and vehicles are created through booking.
2. Out of Scope, Non-goals: replace "customer and vehicle registration (assumed to exist)" with "separate customer and vehicle registration; customers and vehicles are created at booking". Customer login stays out of scope.
3. Domain Model [Resolved]: Customer has `name` and `phone`. Vehicle has `licensePlate` (unique, compared after normalization: uppercase, spaces, "-" and "." removed) and optional make/model. Vehicle still belongs to one Customer.
4. API Contract, Book Appointment [Resolved]: booking flow is personal info (name, phone) → vehicle info (license plate, optional make/model) → dealership → service type → desired start time. Inputs replace `customerId` and `vehicleId` with `name`, `phone`, `licensePlate`, optional make/model. Rules: new plate → create customer and vehicle; existing plate with matching phone → reuse the vehicle and its owner, entered name does not overwrite; existing plate with a different phone → reject 409.
5. API Contract, read-only operations [Resolved]: remove "List Vehicles of a Customer". "List Service Types" takes `dealershipId`. Add "Look Up Appointments": input `licensePlate` + `phone`; returns that vehicle's appointments with start/end time, dealership, service type, status — no name or phone. A plate/phone mismatch returns the same "not found" result as an unknown plate. This operation is supplementary, beyond the three Core Requirements.
6. Assumptions, item 10 [Resolved]: replace with "No login. A customer is identified by the vehicle's license plate. MVP assumes one plate maps to one phone number; a booking with a known plate and a different phone is rejected."

### 2026-10-17 03:03 — Phase 4 — Spec Record (I-13, 404s, validation order)

/spec-record Invariants, API Contract -- 
1. Invariants, add I-13 — Start Within Working Hours [Resolved]: a booking is rejected (400) when `startTime`, in the dealership's local time, is before `openTime` or at/after `closeTime`.
2. API Contract, rejection responses [Resolved]: add "`startTime` outside working hours (I-13)" → 400; "Unknown `dealershipId`" → 404; "Unknown `serviceTypeId`, or service type not offered by the dealership" → 404.
3. API Contract, add subsection "Validation order" [Resolved]: checks run in this order and the first failure is returned: (1) input format (400); (2) dealership and service type exist and match (404); (3) time rules — past, outside working hours, overnight consent (400); (4) plate/phone match (409); (5) a technician with the required skill exists (422); (6) vehicle has no overlapping booking (409); (7) a free service bay (409); (8) a free qualified technician (409).

### 2026-10-17 07:42 — Phase 4 — Spec Record (draft decisions file)

/spec-record docs/drafts/spec-record-decisions.md

### 2026-10-17 07:55 — Phase 4 — Spec Record (Q4–Q16 from draft decisions file)

/spec-record docs/drafts/spec-record-decisions.md

### 2026-10-17 08:24 — Phase 4 — TDD Red Round 1 (working-hours & time rules)

/tdd-red Round 1 -- docs/drafts/book-appointment-test-cases.md

### 2026-10-17 08:31 — Phase 4 — TDD Green Round 1 (working-hours & time rules)

/tdd-green Working-hours endTime and time rules (Round 1) -- allowed: src/modules/scheduling/domain/working-hours.ts, src/modules/scheduling/domain/scheduling.exceptions.ts

### 2026-10-17 08:37 — Phase 4 — TDD Refactor Round 1 (formatter cache, exception names)

/tdd-refactor src/modules/scheduling/domain/working-hours.ts, src/modules/scheduling/domain/scheduling.exceptions.ts -- (1) offsetMs creates a new Intl.DateTimeFormat on every call; cache one formatter per timezone. (2) Exceptions extend Error with no name or message; set name to the class name and add a default message. No behavior or test changes.

### 2026-10-17 08:45 — Phase 4 — TDD Red Round 1b (license plate normalization)

/tdd-red Round 1b -- docs/drafts/book-appointment-test-cases.md

### 2026-10-17 08:54 — Phase 4 — TDD Green Round 1b (license plate normalization)

/tdd-green License plate normalization (Round 1b) -- allowed: src/modules/scheduling/domain/license-plate.ts

### 2026-10-17 09:05 — Phase 4 — TDD Red Round 2 (happy path & allocation)

/tdd-red Round 2, section "Happy path & allocation" -- docs/drafts/book-appointment-test-cases.md

### 2026-10-17 09:27 — Phase 4 — TDD Green Round 2 (happy path & allocation)

/tdd-green Book appointment happy path & allocation (Round 2, T2.1–T2.9) -- allowed: src/modules/scheduling/application/book-appointment.use-case.ts, src/modules/scheduling/domain/working-hours.ts (add an exported helper only; do not change existing behavior)

### 2026-10-17 09:31 — Phase 4 — TDD Red Round 2 (customer & vehicle resolution)

/tdd-red Round 2, section "Customer & vehicle resolution" -- docs/drafts/book-appointment-test-cases.md -- note: T2.11 and T2.13 may already pass because the happy-path green reuses vehicles by plate; that is expected, keep them as written.

### 2026-10-17 09:34 — Phase 4 — TDD Green Round 2 (customer & vehicle resolution)

/tdd-green Customer & vehicle resolution (Round 2, T2.10–T2.15) -- allowed: src/modules/scheduling/application/book-appointment.use-case.ts. Notes: run the plate lookup and phone check before allocation (Validation order step 4), keep customer/vehicle creation last; compare phones with spaces removed on both stored and input values.

### 2026-10-17 09:48 — Phase 4 — TDD Red Round 2 (rejections & validation order)

/tdd-red Round 2, section "Rejections" and "Validation order" (T2.16–T2.22) -- docs/drafts/book-appointment-test-cases.md

### 2026-10-17 09:51 — Phase 4 — TDD Red Round 2 (T2.22 time rules in use case)

/tdd-red Round 2, T2.22 only -- docs/drafts/book-appointment-test-cases.md -- append to tests/unit/scheduling/book-appointment.use-case.spec.ts
