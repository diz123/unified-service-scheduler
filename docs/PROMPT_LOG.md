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
