# Book Appointment — Test Case List (rev 4)

Sources: `docs/DESIGN.md` including the recorded edge-case decisions (I-x = Invariant, A-x = Assumption, OQ-x = Open Question), `docs/adr/0001-tech-stack.md`.

Scope: the Book Appointment operation only. Read-only operations (List Dealerships, List Service Types, Look Up Appointments) are not covered here.

Domain and use-case tests assert domain exceptions; the HTTP status is the presentation-layer mapping and is asserted only in Rounds 3 and 4b.

Validation order (DESIGN.md, recorded): 1 input format 400 → 2 dealership/service type 404 → 3 time rules 400 → 4 plate/phone 409 → 5 skill 422 → 6 vehicle overlap 409 → 7 free bay 409 → 8 free technician 409.

## Round 1 — Domain: working-hours & time rules

File: `tests/unit/scheduling/working-hours.spec.ts` — run with `pnpm test`. Pure functions, no DB, `now` injected.

Default fixture: Dealership D1, `Asia/Ho_Chi_Minh`, 08:00–17:00. Times are local unless suffixed `Z`.

- T1.1 [I-7, I-4] Same-day: 09:00 + 120 min → endTime 11:00 local (04:00Z), spansOvernight = false.
- T1.2 [I-7, I-11] Ends exactly at closeTime: 15:00 + 120 → 17:00 local same day (10:00Z), spansOvernight = false.
- T1.3 [I-7] Off-by-one at close: 16:59 + 1 → 17:00 same day; 16:59 + 2 → 08:01 next day.
- T1.4 [I-7 spec example] Roll over: 16:00 + 120 → 09:00 next day, spansOvernight = true.
- T1.5 [I-7] Multi-day: 08:00 + 720 → 11:00 next day, spansOvernight = true.
- T1.6 [I-4, I-7] Timezone not hardcoded: same local start and duration at D1 and at D2 (different tz, e.g. `Asia/Tokyo`) → different UTC endTime.
- T1.7 [I-11] Overnight without consent: overnight result with `overnightConsent = false` → OvernightConsentRequiredException; field omitted → OvernightConsentRequiredException.
- T1.8 [I-11] Overnight with consent: `overnightConsent = true` → valid.
- T1.9 [I-11] Consent ignored when not overnight: same-day result with `overnightConsent = true` → valid.
- T1.10 [I-11] Local date ≠ UTC date: dealership opening 06:00 local (= 23:00Z previous UTC day), service ends the same local day → no consent required even though the UTC dates differ.
- T1.11 [I-9] Past: `startTime < now` → PastStartTimeException; `startTime == now` → PastStartTimeException (I-9: past means `startTime <= now`).
- T1.12 [I-13] Start within working hours: 07:59 → OutsideWorkingHoursException; 17:00 → OutsideWorkingHoursException; 08:00 → accepted; 16:59 → accepted.

## Round 1b — Domain: license plate normalization

File: `tests/unit/scheduling/license-plate.spec.ts` — run with `pnpm test`. Pure function, no DB.

- T1.13 [Vehicle.licensePlate] Uppercases and removes spaces, `-` and `.`: `51a-123.45` → `51A12345`; ` 51A 123 45 ` → `51A12345`.
- T1.14 [Vehicle.licensePlate] Two inputs that differ only by case, spaces, `-` or `.` normalize to the same value.

## Round 2 — Use case: BookAppointmentUseCase, resolution & allocation

File: `tests/unit/scheduling/book-appointment.use-case.spec.ts` — run with `pnpm test`. In-memory repositories / mock UnitOfWork.

Note: the in-memory fakes re-implement overlap and lookup logic, so boundary cases are re-verified against the real DB in Round 3.

### Happy path & allocation

- T2.1 [I-1, I-5, I-6] Happy path: returns `Confirmed` appointment linking Customer, Vehicle, Dealership, ServiceType, ServiceBay, Technician, with the computed endTime.
- T2.2 [A-2, I-1] Fewest workload: Tech A has 2 appointments on the local date, Tech B has 1, Tech C (unqualified) has 0; all free in the slot → Tech B.
- T2.3 [A-2 workload date] Overnight appointment from the previous day that overlaps the requested date counts toward that date's workload.
- T2.4 [A-2 fixed order] Workload tie → technician with the lowest `name` (ascending), e.g. "Tech 01" before "Tech 02".
- T2.5 [A-3 fixed order] Bay order by `name` ascending: all free → "Bay 01"; "Bay 01" busy → "Bay 02".
- T2.6 [I-2] Back-to-back allowed in both directions on the same bay/technician/vehicle: existing 08:00–10:00 + new 10:00–11:00; existing 11:00–12:00 + new 10:00–11:00.
- T2.7 [I-2, I-7] Overnight occupancy: existing 16:00 → 09:00 next day on the only bay; new 08:00 next day → BayUnavailableException; new 09:00 next day → succeeds.
- T2.8 [I-2, OQ-1, A-2] Cancelled ignored: an overlapping `Cancelled` appointment (seeded directly) on the same bay/technician/vehicle does not block and is not counted in workload.
- T2.9 [I-8] Same dealership only: Dealership A full, Dealership B has free qualified resources → Bay/TechnicianUnavailableException from A; B's resources are never assigned.

### Customer & vehicle resolution

- T2.10 [Resolution] New plate → creates Customer (`name`, `phone`) and Vehicle (normalized `licensePlate`, optional `make`/`model`) and books.
- T2.11 [Resolution] Existing plate + matching phone → reuses the vehicle and its owner; a different `name` in the request does not overwrite the stored name.
- T2.12 [Resolution, A-10] Existing plate + different phone → PlatePhoneMismatchException; no customer or vehicle is created or changed.
- T2.13 [Resolution, T1.13] Lookup uses the normalized plate: stored `51A12345`, request `51a-123.45` with the same phone → treated as the existing vehicle.
- T2.14 [Resolution] Existing plate with different `make`/`model` in the request → stored values are kept.
- T2.15 [Resolution] Phone comparison: stored `0901234567`; request `090 123 4567` → match (spaces removed); request `+84901234567` → PlatePhoneMismatchException (no country-code normalization).

### Rejections

- T2.16 [404] Unknown `dealershipId`; unknown `serviceTypeId`; service type not offered by the dealership → ResourceNotFoundException (one case each).
- T2.17 [422, A-6] No technician at the dealership holds `requiredSkill` (even if another dealership has one) → SkillMismatchException.
- T2.18 [I-10, A-8] The vehicle (same plate and phone) has an overlapping `Confirmed` booking at the same dealership, and (separately) at another dealership → VehicleUnavailableException.
- T2.19 [I-1, I-2] All bays overlap, a qualified technician is free → BayUnavailableException.
- T2.20 [I-1, I-2] Qualified technicians exist but all are busy, a bay is free → TechnicianUnavailableException.

### Validation order (recorded)

- T2.21 [Validation order] Each pair returns the earlier step: unknown dealership + past startTime → 404; past startTime + plate/phone mismatch → 400; plate/phone mismatch + no skilled technician → PlatePhoneMismatchException; no skilled technician + vehicle overlap → 422; vehicle overlap + all bays busy → vehicle 409; all bays busy + all technicians busy → bay 409.

- T2.22 [I-9, I-13, I-11] The use case enforces the time rules: past `startTime` → PastStartTimeException; start at 17:00 local → OutsideWorkingHoursException; a booking that ends on a later local date with `overnightConsent` omitted → OvernightConsentRequiredException; the same booking with `overnightConsent: true` → Confirmed.

Note: the order inside step 3 (past, working hours, overnight consent) all returns 400, so it is not tested here.

## Round 3 — Integration: real PostgreSQL (use case + Prisma adapter, no HTTP)

Decision: Round 3 calls `BookAppointmentUseCase` with the real Prisma adapter. HTTP status mapping is tested in Round 4b. "Succeeds" means a `Confirmed` appointment is returned; "rejected" means the named domain exception is thrown; "no unexpected error" means every rejection is a domain exception — no raw Prisma/PostgreSQL error (e.g. 23P01, 23505, 40P01) and no timeout.

Shared preconditions for 3a–3c:

- `docker compose up -d` is healthy and `.env` holds `DATABASE_URL` (copy from `.env.example`).
- Migrations are applied before the run. Tests truncate all tables before each test, so do not point `DATABASE_URL` at data you need.
- Concurrency tests: Prisma pool size ≥ N (ADR-0001). Every concurrent request uses a distinct `licensePlate` unless the case says otherwise; a shared plate would hit the plate lock / I-10 and mask the bay/technician race.

## Round 3a — Schema & constraints

File: `tests/integration/scheduling/schema-constraints.integration.spec.ts` — run with `pnpm test:integration`.

Allowed: `prisma/schema.prisma`, `prisma/migrations/**`, `tests/integration/support/**`.

- T3.15 [ADR Layer 2] Raw SQL bypassing the app: overlapping `Confirmed` rows on the same bay / technician / vehicle → SQLSTATE 23P01 with constraint `appointment_bay_no_overlap` / `appointment_technician_no_overlap` / `appointment_vehicle_no_overlap` (one test each); touching `[)` intervals → accepted; overlap with an existing `Cancelled` row → accepted.
- T3.17 [A-4] Raw SQL: inserting a Dealership with `openTime >= closeTime` is rejected by a CHECK constraint.
- T3.18 [Vehicle.licensePlate] Raw SQL: inserting two vehicles with the same normalized `licensePlate` is rejected by a unique constraint.

## Round 3b — Unit-of-Work adapter

File: `tests/integration/scheduling/booking-unit-of-work.integration.spec.ts` — run with `pnpm test:integration`.

Allowed: `src/modules/scheduling/infrastructure/**`, `src/shared/infrastructure/database/**`, `tests/integration/support/**`.

- T3.1 [I-2] Back-to-back at 10:00 through the real query and constraint → succeeds.
- T3.2 [I-2] A seeded overlapping `Cancelled` appointment does not block → succeeds.
- T3.3 [I-10] Same plate and phone, overlapping booking at another dealership, through the real query → VehicleUnavailableException.
- T3.3b [I-10] The vehicle check is scoped to the requesting vehicle: an existing plate books successfully while a different vehicle has an overlapping `Confirmed` booking on another bay at the same dealership.
- T3.4 [Resolution] Plate normalization through the real lookup and unique constraint: stored `51A12345`, request `51a-123.45` → reuses the vehicle (no second Vehicle row).
- T3.14 [Resolution, rejected booking creates nothing] A rejected booking with a new plate (e.g. no free bay) leaves no Customer or Vehicle row.
- T3.14b [ADR Amendment 1, no orphan customers] run() rolls back: when the appointment insert fails after the customer and vehicle were created, no Customer or Vehicle row remains.
- T3.16 [ADR Layer 2] Adapter mapping: a 23P01 from each constraint (triggered by calling the adapter's appointment insert directly, bypassing locks) is rethrown as Bay / Technician / VehicleUnavailableException (one test each).

## Round 3c — Concurrency

File: `tests/integration/scheduling/booking-concurrency.integration.spec.ts` — run with `pnpm test:integration`.

Allowed: `src/modules/scheduling/infrastructure/**`, `tests/integration/support/**`.

- T3.5 [I-3] Last-bay race: N = 10 parallel bookings, same slot, 1 free bay, technicians plentiful → exactly 1 succeeds, N−1 BayUnavailableException, no unexpected error.
- T3.6 [I-3] Last-technician race: 1 free qualified technician, bays plentiful → exactly 1 succeeds, N−1 TechnicianUnavailableException, no unexpected error.
- T3.7 [I-3] Partial-overlap race: N bookings with staggered starts that all pairwise overlap the single free bay (e.g. 09:00, 09:30, 10:00 with 120 min) → exactly 1 succeeds.
- T3.8 [ADR Layer 1] No false contention: 2 parallel bookings, same dealership, 2 free bays + 2 free qualified technicians → both succeed, with distinct bays and distinct technicians. It fails when the Dealership row lock is missing (Layer 2 would reject the second booking); T3.6, T3.9 and T3.11–T3.13 also fail without Layer 1.
- T3.9 [I-10] Same existing vehicle, same dealership: N parallel bookings → exactly 1 succeeds, N−1 VehicleUnavailableException.
- T3.10 [I-10, ADR lock order] Same existing vehicle, two dealerships, overlapping intervals, in parallel → exactly 1 succeeds and 1 VehicleUnavailableException; no deadlock (40P01) and no timeout.
- T3.11 [Resolution, concurrent new plate] Same NEW plate, same phone, two parallel bookings at two dealerships, non-overlapping times → both succeed; exactly one Customer row and one Vehicle row.
- T3.12 [Resolution, concurrent new plate] Same NEW plate, same phone, two parallel bookings at two dealerships, overlapping times → exactly 1 succeeds, 1 VehicleUnavailableException; one Vehicle row; no unexpected error.
- T3.13 [Resolution, concurrent new plate] Same NEW plate, different phones, two parallel bookings at two dealerships → exactly 1 succeeds, 1 PlatePhoneMismatchException; no unexpected error.
- T3.19 [ADR Amendment 1, rollback under contention] Two different NEW plates, two parallel bookings for the last free bay → exactly 1 succeeds, 1 BayUnavailableException; exactly one Customer row and one Vehicle row remain.
- Note (from Round 3b review): set the interactive transaction's `timeout`, `maxWait` and `isolationLevel` explicitly; races T3.5–T3.7 must end in 409s, never in a transaction-timeout error.

## Round 4a — Presentation: request DTO validation (no DB)

File: `tests/unit/scheduling/book-appointment.dto.spec.ts` — run with `pnpm test`. Validates the HTTP DTO in isolation (class-validator), before mapping to the application command.

- T4.2 [Validation step 1] 400: each required field missing (`name`, `phone`, `licensePlate`, `dealershipId`, `serviceTypeId`, `startTime`); `startTime` not ISO 8601; `overnightConsent` not a boolean; blank after normalization (A-11): `name: "   "`, `licensePlate: " - . "`, `phone: "   "`. `make`, `model`, `overnightConsent` omitted → accepted. Well-formed but impossible `startTime` (`2030-02-30T02:00:00Z`, `2030-01-15T25:00:00Z`) → 400. Empty `dealershipId` or `serviceTypeId` (`""`) → 400.
- T4.3 [Validation step 1] 400: `startTime` with an offset other than `Z` (e.g. `+07:00`).
- T4.4 [Validation step 1] 400: `startTime` with non-zero seconds or milliseconds.
- T4.4b [Validation step 1, A-13] 400: `startTime` without seconds (`2030-01-15T02:00Z`), with more than 3 fraction digits (`2030-01-15T02:00:00.0000Z`), or with lowercase `z` (`2030-01-15T02:00:00z`).

## Round 4b — E2E: HTTP contract (real PostgreSQL)

File: `tests/integration/scheduling/book-appointment.http.spec.ts` — run with `pnpm test:integration`. Boots the NestJS app in-process and calls the endpoint via supertest.

- T4.1 201 response contains `id`, `startTime`, `endTime`, `status`, assigned `ServiceBay`, assigned `Technician`.
- T4.5 Exception → status mapping: one request each producing 400 (past), 404, 422, 409 (bay), 409 (plate/phone mismatch). A separate malformed request (`startTime` with `+07:00`) → 400 proves the global validation pipe is wired; a past time cannot prove it, because the use case also rejects it with 400.
- T4.6 The exception filter maps a Prisma transaction timeout (P2028) to 503, not 500.
- T4.7 `overnightConsent: "false"` (a string) → 400. The global ValidationPipe must not use implicit type conversion.
