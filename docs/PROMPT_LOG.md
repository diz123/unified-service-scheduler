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

### 2026-10-16 17:21 — Phase 2 — Spec Record (Scale assumption)

/spec-record Assumptions -- Replace assumption 5 (Scale) with: Scale [Assumed, not sourced]: ~3–5 million registered vehicles across ~500 dealerships in Vietnam (~20 ServiceBays, ~40 Technicians each). At 2–3 services per vehicle per year, that is ~16,000–41,000 bookings/day. Normal load ~1,000 concurrent users; seasonal or campaign peaks 5,000–10,000. Derived: booking writes average ~1.2/s and peak ~12/s; most concurrent users are reading availability, not writing. Contention is local to one dealership and time window, not global.
