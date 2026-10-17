# DESIGN — The Unified Service Scheduler

> [!IMPORTANT]
> **Current Phase: 4 — Implement**

---

## Overview

**Goal** **[Given]**: Build an MVP for "The Unified Service Scheduler" to replace manual booking systems.

**Domain** **[Given]**: Ownership. Scope is strictly the core appointment scheduling workflow and dual-resource allocation.

**MVP Status Scope** **[Assumed]**: A successful booking creates an `Appointment` in `Confirmed` status. No status transitions other than initial creation are implemented in this phase. (See [OQ-1](#oq-1--status-machine-scope).)

### Core Requirements [Given]

1. **Resource-Constrained Booking** — Allow a user to request a service appointment for a specific vehicle, service type, and dealership at a desired time.
2. **Real-Time Availability Check** — Before confirming, verify the availability of both a `ServiceBay` and a qualified `Technician` for the entire service duration.
3. **Confirmed Appointment Record** — Upon success, create a persistent `Appointment` record associating the customer, vehicle, technician, and service bay.

### Target Deliverables [Assumed + Resolved]

Complete MVP system design and workflow, architectural decision record (ADR-0001), implementation planning documentation, and a backend MVP codebase covering the three core requirements above.

**[Resolved]** Also:

- A booking frontend — one page to book an appointment.
- A seed script that loads sample master data (dealerships, service bays, technicians with skills, and service types only) so the system can be run and tested. Customers and vehicles are created through booking.

### Scope Decision [Resolved]

Backend first. The frontend starts only after the backend is complete and `pnpm verify` passes. If time runs out, the backend alone is the submission. The frontend stack will be decided in ADR-0002 at that point. No unrequested feature expansion.

### Out of Scope for MVP

**Next phase**: On-arrival technician adjustment of service time/duration; multi-service bookings; nearest-slot suggestions on rejection; customer cancellation and rescheduling; booking limits per vehicle (anti-spam); per-technician shifts, breaks, and holidays; closed-day and holiday handling; master-data CRUD endpoints; notifications; available time-slot listing.

**Why time-slot listing is next phase**: Core Requirement 1 is a request at a desired time, and Core Requirement 2 checks availability before confirming, so availability is checked on booking submission; a slot listing would not remove that check.

**Non-goals**: Authentication and authorization; separate customer and vehicle registration (customers and vehicles are created at booking); payment and pricing; mobile; reporting; external integrations (DMS).

---

## Domain Model

### Entities

**Customer** **[Resolved]**
- `name`, `phone`.
- Created at booking. No separate registration endpoint in MVP scope.

**Vehicle** **[Assumed + Resolved]**
- Belongs to one `Customer`.
- `licensePlate`: unique, compared after normalization (uppercase; spaces, `-` and `.` removed). **[Resolved]**
- Optional `make` and `model`. **[Resolved]**
- Created at booking. No separate registration endpoint in MVP scope. **[Resolved]**

**Dealership** **[Given + Resolved]**
- `openTime`, `closeTime` (local time, e.g. `08:00`), `timezone` (IANA timezone identifier).
- Defines its own `ServiceType`s.
- Operates every day; closed days and holidays are out of scope for this phase.

**ServiceType** **[Assumed]**
- Belongs to one `Dealership`.
- `requiredSkill`: exactly one skill value.
- `durationMinutes`: integer number of working minutes. **[Resolved]**

**ServiceBay** **[Assumed + Resolved]**
- Belongs to one `Dealership`.
- Accommodates exactly one vehicle (and one technician) at a time.

**Technician** **[Assumed + Resolved]**
- Belongs to one `Dealership`.
- Holds one or more skills (e.g., Maintenance, Brakes & Suspension, Electrical, Overhaul, EV Charging).
- Works on at most one vehicle at a time.

**Appointment** **[Given]**
- Links: `Customer`, `Vehicle`, `Dealership`, `ServiceType`, `ServiceBay`, `Technician`.
- `startTime`: ISO 8601 UTC, supplied by the client.
- `endTime`: ISO 8601 UTC, derived server-side from `ServiceType.durationMinutes` counted in dealership working hours. **[Resolved]**
- `status`: explicit state machine — `Confirmed` | `Cancelled`. The MVP only creates `Confirmed`; no cancellation endpoint is implemented in this phase.

### Relationships

- `Vehicle` → `Customer` (many-to-one).
- `ServiceType`, `ServiceBay`, `Technician` → `Dealership` (many-to-one each). **[Resolved]**
- `Technician` ↔ skills (many-to-many).
- `ServiceType` → skill (many-to-one, exactly one required skill).
- `Appointment` → one `ServiceBay` and one `Technician`, both from the same `Dealership` as the appointment. **[Resolved]**

---

## Invariants

### I-1 — Dual-Resource Allocation **[Given — CLAUDE.md §5.1]**

An appointment requires BOTH an available `ServiceBay` AND an available, qualified `Technician` for the entire interval `[startTime, endTime)`. A `Technician` is qualified when their skill set includes `ServiceType.requiredSkill`.

### I-2 — Overlap Definition **[Given — CLAUDE.md §5.2]**

Two intervals conflict when:

```
existing.startTime < new.endTime  AND  existing.endTime > new.startTime
```

Only appointments in an active status count toward conflicts; cancelled appointments release their resources.

### I-3 — No Double-Booking **[Given — CLAUDE.md §5.3]**

Double-booking is strictly prohibited. Bay and technician allocation MUST be enforced atomically under concurrent requests. The enforcement mechanism is defined in ADR-0001.

### I-4 — Time and Precision **[Given — CLAUDE.md §5.4]**

All timestamps are ISO 8601 UTC. Durations are integer minutes.

### I-5 — Data Integrity **[Given — CLAUDE.md §5.5]**

A confirmed `Appointment` MUST link `Customer`, `Vehicle`, `Dealership`, `ServiceType`, `Technician`, and `ServiceBay`.

### I-6 — Status Lifecycle **[Given — CLAUDE.md §5.6]**

Appointment status is modeled as an explicit state machine, never as independent boolean flags.

### I-7 — Working-Hours endTime **[Resolved]**

`endTime` is derived server-side by advancing `startTime` by `ServiceType.durationMinutes` counted in the dealership's working hours only. Hours outside `openTime`–`closeTime` are skipped. The result is stored as one continuous `[startTime, endTime)` interval in UTC; the `ServiceBay` and `Technician` are reserved for the full interval.

Example: a 2-hour service at 16:00 at a dealership closing at 17:00 → `endTime` = 09:00 the next working day.

### I-8 — Same-Dealership Resources **[Resolved]**

The assigned `ServiceBay` and `Technician` MUST belong to the same `Dealership` as the appointment.

### I-9 — Past-Time Rejection **[Resolved]**

A booking request with a `startTime` already in the past is rejected (HTTP 400). Past means `startTime <= now` (server clock).

### I-10 — No Overlapping Vehicle Bookings **[Assumed]**

A vehicle cannot have two bookings whose intervals overlap, even across different dealerships.

### I-11 — Overnight Consent **[Assumed]**

`overnightConsent` is an optional boolean field, default `false`. It is evaluated only when the computed `endTime` falls on a later local date than `startTime` (in the dealership's timezone). When that condition holds, a value other than `true` rejects the booking (400).

### I-12 — One Service per Booking **[Assumed]**

Each booking covers exactly one service type.

### I-13 — Start Within Working Hours **[Resolved]**

A booking is rejected (400) when `startTime`, in the dealership's local time, is before `openTime` or at/after `closeTime`.

---

## API Contract

> Stack-agnostic logical contract. Precise HTTP paths, verbs, headers, and serialization formats
> are specified in Phase 3 after ADR-0001 is accepted.

### Operation: Book Appointment

**Intent**: Request a confirmed appointment for a vehicle at a dealership.

**Booking flow** **[Resolved]**: personal info (name, phone) → vehicle info (license plate, optional make/model) → dealership → service type → desired start time.

**Request inputs**:

| Field | Type | Tag | Notes |
|---|---|---|---|
| `name` | string | **[Resolved]** | Customer name |
| `phone` | string | **[Resolved]** | Customer phone |
| `licensePlate` | string | **[Resolved]** | The vehicle to be serviced |
| `make` | string | **[Resolved]** | Optional |
| `model` | string | **[Resolved]** | Optional |
| `dealershipId` | identifier | **[Given]** | Target dealership |
| `serviceTypeId` | identifier | **[Given]** | Requested service |
| `startTime` | ISO 8601 UTC | **[Given]** | Desired start time |
| `overnightConsent` | boolean | **[Resolved]** | Optional, default `false`. Checked only when `endTime` falls on a later local date than `startTime`; booking rejected (400) if `false` in that case |

**Customer and vehicle resolution** **[Resolved]**:

- New plate → create the customer and the vehicle.
- Existing plate with a matching phone → reuse the vehicle and its owner; the entered name does not overwrite the stored name.
- Existing plate with a different phone → reject (409), raising `PlatePhoneMismatchException`.
- For an existing plate, `make` and `model` in the request do not overwrite the stored values.
- A new customer and vehicle are saved only if the booking succeeds; a rejected booking creates nothing.
- Phone numbers are compared exactly after removing spaces; no country-code normalization (`0901234567` and `+84901234567` are different).
- Concurrent bookings with the same new plate behave as if run one after the other: one creates the customer and vehicle; the other is treated as an existing plate (matching phone → normal checks; different phone → 409). Never 500.

**Success response** **[Assumed]**: The created `Appointment` including `id`, `startTime`, `endTime`, `status`, assigned `ServiceBay`, and assigned `Technician`.

**Rejection responses**:

| Condition | HTTP | Tag |
|---|---|---|
| `startTime` is in the past | 400 | **[Resolved]** |
| `overnightConsent` is `false` when `endTime` falls on a later local date than `startTime` | 400 | **[Resolved]** |
| No `Technician` at the dealership holds the required skill | 422 | **[Assumed]** |
| No available `ServiceBay` for the interval | 409 | **[Assumed]** |
| No available qualified `Technician` for the interval | 409 | **[Assumed]** |
| Vehicle already has a conflicting booking | 409 | **[Assumed]** |
| Existing `licensePlate` with a different `phone` | 409 | **[Resolved]** |
| `startTime` outside working hours (I-13) | 400 | **[Resolved]** |
| Unknown `dealershipId` | 404 | **[Resolved]** |
| Unknown `serviceTypeId`, or service type not offered by the dealership | 404 | **[Resolved]** |

**Vehicle conflict** **[Resolved]**: a vehicle conflict raises `VehicleUnavailableException` → 409.

**Frontend handling** **[Resolved]**: On rejection, the booking frontend shows the reason and keeps the form so the customer can pick another time.

#### Validation order **[Resolved]**

Checks run in this order and the first failure is returned:

1. Input format (400). `startTime` must use the `Z` suffix (any other offset → 400) and be minute-aligned (seconds and milliseconds = 0, else 400).
2. Dealership and service type exist and match (404).
3. Time rules — past, outside working hours, overnight consent (400).
4. Plate/phone match (409).
5. A technician with the required skill exists (422).
6. Vehicle has no overlapping booking (409).
7. A free service bay (409).
8. A free qualified technician (409).

### Read-Only Operations for the Booking Frontend **[Resolved]**

Read-only operations used by the booking frontend. No create, update, or delete operations for master data.

| Operation | Input | Returns |
|---|---|---|
| List Dealerships | — | Dealerships |
| List Service Types | `dealershipId` | Service types |
| Look Up Appointments | `licensePlate`, `phone` | That vehicle's appointments: start/end time, dealership, service type, status. No name or phone. |

**Look Up Appointments** is supplementary, beyond the three Core Requirements. A plate/phone mismatch returns the same "not found" result as an unknown plate.

---

## Assumptions

1. **Auto-allocation** **[Assumed]** — Customers enter their vehicle (license plate) and select dealership, `ServiceType`, and desired time only. The system assigns `ServiceBay` and `Technician`; customers cannot specify them.

2. **Technician allocation order** **[Resolved]** — Prefer the technician with the fewest confirmed appointments whose `[startTime, endTime)` interval overlaps the requested calendar date (in dealership local time; each appointment counts as 1). Ties broken by fixed order only. The workload date is the local date of `startTime`; count `Confirmed` appointments whose interval overlaps `[00:00, 24:00)` local of that date. Fixed order = ascending by `name`; seed names are zero-padded (e.g. "Bay 01", "Bay 02") so text order matches numeric order.

3. **Bay allocation order** **[Resolved]** — Fixed order only. Fixed order = ascending by `name`; seed names are zero-padded (e.g. "Bay 01", "Bay 02") so text order matches numeric order.

4. **Per-dealership operating hours** **[Resolved]** — Each `Dealership` stores `openTime`, `closeTime`, and `timezone`. All dealerships operate every day; closed days and holidays are next phase. `openTime` < `closeTime` on the same local day; working hours never cross midnight. All dealerships are in Vietnam (no DST); DST handling is out of scope.

5. **Scale** **[Assumed, not sourced]** — ~3–5 million registered vehicles across ~500 dealerships in Vietnam (~20 `ServiceBay`s, ~40 `Technician`s each). At 2–3 services per vehicle per year, that is ~16,000–41,000 bookings/day. Normal load ~1,000 concurrent users; seasonal or campaign peaks 5,000–10,000. Derived: booking writes average ~1.2/s and peak ~12/s; most concurrent users are reading availability, not writing. Contention is local to one dealership and time window, not global.

6. **Skill model** **[Assumed]** — Each `ServiceType` requires exactly one skill. Each `Technician` may hold multiple skills. Qualification check for MVP: skill match only.

7. **One technician per bay per appointment** **[Assumed]** — A `ServiceBay` accommodates exactly one technician working on one vehicle at a time.

8. **Cross-dealership vehicle-overlap check** **[Assumed]** — A vehicle is a physical object and cannot be serviced at two dealerships simultaneously. A booking that overlaps an existing booking for the same vehicle at any dealership is rejected.

9. **Overnight consent field** **[Resolved]** — `overnightConsent` is an optional boolean, default `false`. It is evaluated only when `endTime` falls on a later local date than `startTime`; the booking is rejected (400) when it is `false` in that case.

10. **Customer identification** **[Resolved]** — No login. A customer is identified by the vehicle's license plate. MVP assumes one plate maps to one phone number; a booking with a known plate and a different phone is rejected.

11. **Non-blank identity fields** **[PENDING APPROVAL]** — `name` must contain at least one non-whitespace character; `licensePlate` must contain at least one letter or digit after normalization; `phone` must contain at least one digit after removing spaces. A violation is rejected (400) at Validation order step 1.

---

## Open Questions

### OQ-1 — Status Machine Scope

**Resolved**: The state machine is `Confirmed` | `Cancelled`. The MVP only creates `Confirmed` appointments; the cancellation endpoint is deferred to the next phase. `Cancelled` exists in the schema so that future cancellations release resources per I-2.
