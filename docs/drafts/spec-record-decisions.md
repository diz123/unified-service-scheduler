# Spec Record — Book Appointment Decisions (draft)

Status: agreed (engineer, 2026-10-17).

Removed because already recorded in `docs/DESIGN.md` (commit d826a7e): Q1 (I-13), Q2 (404 rows; vehicle ownership replaced by plate/phone 409), Q3 (8-step Validation order wins).

Notes:

- `/spec-record` only edits `docs/DESIGN.md`. If Q10 or Q13 is kept, add the exception → 409 to the exception table in `CLAUDE.md` §7 separately.
- Q12 also needs an update to ADR-0001 (Layer 1 locks the Vehicle row, which does not exist yet for a new plate).

```
/spec-record Invariants; API Contract; Assumptions -- 
Q4 (Assumptions 2 and 3): "fixed order" for technicians and bays = ascending by `name`; seed names are zero-padded (e.g. "Bay 01", "Bay 02") so text order matches numeric order.
Q5 (Assumption 2): workload date = local date of startTime; count Confirmed appointments whose interval overlaps [00:00, 24:00) local of that date.
Q6 (API Contract, Validation order step 1): startTime must use the Z suffix; any other offset → 400.
Q7 (API Contract, Validation order step 1): startTime must be minute-aligned (seconds and milliseconds = 0), else 400.
Q8 (I-9): past means startTime <= now (server clock).
Q9 (Assumption 4): openTime < closeTime on the same local day; working hours never cross midnight.
Q10 (API Contract): vehicle conflict raises VehicleUnavailableException → 409.
Q11 (Assumption 4): all dealerships are in Vietnam (no DST); DST handling is out of scope.
Q12 (API Contract, Customer and vehicle resolution): concurrent bookings with the same new plate behave as if run one after the other: one creates the customer and vehicle; the other is treated as an existing plate (matching phone → normal checks; different phone → 409). Never 500.
Q13 (API Contract): existing plate with a different phone raises PlatePhoneMismatchException → 409.
Q14 (API Contract, Customer and vehicle resolution): a new customer and vehicle are saved only if the booking succeeds; a rejected booking creates nothing.
Q15 (API Contract, Customer and vehicle resolution): for an existing plate, make and model in the request do not overwrite the stored values.
Q16 (API Contract, Customer and vehicle resolution): phone numbers are compared exactly after removing spaces; no country-code normalization (0901234567 and +84901234567 are different).
```
