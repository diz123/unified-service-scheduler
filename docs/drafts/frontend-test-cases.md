# Frontend Helpers — Test Case List (rev 1)

Sources: `docs/DESIGN.md` (Error response format, Rejection responses, Frontend handling, Read-Only Operations, Assumptions 4, 13, 14), `docs/adr/0002-frontend-stack.md`, backend `tests/unit/scheduling/working-hours.spec.ts`.

Scope: pure helpers in `frontend/lib/` only (ADR-0002 Testing). No React, no DOM, no network. UI behaviour (form kept on rejection, consent checkbox) is checked by hand in the UI rounds (ADR-0002 trade-off 2).

Commands: `pnpm --filter frontend test`, `pnpm --filter frontend typecheck`, `pnpm --filter frontend lint`. The root `pnpm test` / `typecheck` / `lint` check the backend only; `pnpm verify` runs both.

When a case lists several inputs or outcomes, write one test per input (`it.each` counts as one test per row).

## Frontend decisions (agreed 2026-10-17)

FD-1 to FD-3 are recorded in `docs/DESIGN.md`. FD-4 and FD-5 are implementation choices recorded here only.

- FD-1 UI copy: DESIGN says clients rely on `code` but defines no user-facing text. The frontend owns one English message per code. Codes may share a message where the customer action is the same, e.g. BAY_UNAVAILABLE and TECHNICIAN_UNAVAILABLE → "This time is no longer available".
- FD-2 Lookup times: the lookup response has `dealership { id, name }` but no `timezone`. The UI takes the timezone from `GET /dealerships` by id and shows start/end in dealership local time via a `formatLocal` helper (F1.11–F1.12). This helper is an addition to the ADR list; it is the reverse of the conversion the ADR already names.
- FD-3 API unreachable: when the API is down, the proxy returns a non-JSON body or `fetch` throws. Mapped to its own message, "Cannot reach the booking service. Please try again.", distinct from the generic fallback.
- FD-4 Invalid local date/time input: native date/time pickers make it unlikely. `toUtcIso` throws `RangeError`; no silent roll-over.
- FD-5 API client: kept thin and not unit-tested; its parsing logic lives in the pure `parseErrorBody` helper, which is tested.

## Round F1 — Local time ↔ UTC

File: `frontend/tests/unit/local-time.spec.ts`
Allowed: `frontend/lib/local-time.ts`

Signatures: `toUtcIso(date: 'YYYY-MM-DD', time: 'HH:mm', timezone: string): string` and `formatLocal(isoUtc: string, timezone: string): string` → `'YYYY-MM-DD HH:mm'`.

Cases F1.1–F1.4 reuse the backend fixtures' timezones, local times and UTC offsets (ADR-0002: "tested against the same cases as the backend"); the dates differ from the backend tests, which do not affect a fixed-offset conversion. Correct because all dealerships are in Vietnam with no DST (A-4); the Tokyo fixture only proves the timezone is not hardcoded.

- F1.1 [offset as backend T1.1] `2026-11-02`, `09:00`, `Asia/Ho_Chi_Minh` → `2026-11-02T02:00:00.000Z`.
- F1.2 [offset as backend T1.6, D2 fixture] `2026-11-02`, `08:00`, `Asia/Tokyo` → `2026-11-01T23:00:00.000Z` (previous UTC day).
- F1.3 [as backend T1.6] Timezone not hardcoded: the same date and time in `Asia/Ho_Chi_Minh` and `Asia/Tokyo` give different results.
- F1.4 [offset as backend T1.10] `2026-11-02`, `06:00`, `Asia/Ho_Chi_Minh` → `2026-11-01T23:00:00.000Z` (local date ≠ UTC date).
- F1.5 [A-13] Output format: every result matches `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$` (`Z` suffix, seconds `:00`, 3 fraction digits, uppercase `Z`).
- F1.6 Local midnight: `2026-11-02`, `00:00`, `Asia/Ho_Chi_Minh` → `2026-11-01T17:00:00.000Z`.
- F1.7 Year boundary: `2027-01-01`, `00:30`, `Asia/Ho_Chi_Minh` → `2026-12-31T17:30:00.000Z`.
- F1.8 Leap day: `2028-02-29`, `10:00`, `Asia/Ho_Chi_Minh` → `2028-02-29T03:00:00.000Z`.
- F1.9 [FD-4] Malformed input throws `RangeError`: date `2026-13-01`; time `25:00`; time `9:00`; empty date; empty time.
- F1.10 [FD-4] Impossible date throws `RangeError`, no roll-over: `2026-02-30`; `2027-02-29` (not a leap year).
- F1.11 [FD-2] `formatLocal('2026-11-02T02:00:00.000Z', 'Asia/Ho_Chi_Minh')` → `2026-11-02 09:00`; `formatLocal('2026-11-01T23:00:00.000Z', 'Asia/Tokyo')` → `2026-11-02 08:00`.
- F1.12 [FD-2] Round trip: `formatLocal(toUtcIso(d, t, tz), tz)` equals `` `${d} ${t}` `` for the inputs of F1.1, F1.2, F1.4, F1.6, F1.7, F1.8.

## Round F2 — Error mapping and request payloads

Files: `frontend/tests/unit/error-messages.spec.ts`, `frontend/tests/unit/payloads.spec.ts`
Allowed: `frontend/lib/error-messages.ts`, `frontend/lib/payloads.ts`, and `frontend/lib/local-time.ts` (import only, no change)

### Error mapping

Signatures: `parseErrorBody(status: number, body: unknown): ApiError` and `toUserMessage(error: ApiError): { message: string; details: string[] }`.

- F2.1 [FD-1, Rejection responses] Every code returns a non-empty message, table-driven over all 16: `VALIDATION_FAILED`, `START_TIME_IN_PAST`, `OUTSIDE_WORKING_HOURS`, `OVERNIGHT_CONSENT_REQUIRED`, `DEALERSHIP_NOT_FOUND`, `SERVICE_TYPE_NOT_FOUND`, `PLATE_PHONE_MISMATCH`, `NO_QUALIFIED_TECHNICIAN`, `VEHICLE_UNAVAILABLE`, `BAY_UNAVAILABLE`, `TECHNICIAN_UNAVAILABLE`, `SERVICE_BUSY`, `APPOINTMENTS_NOT_FOUND`, `ROUTE_NOT_FOUND`, `REQUEST_REJECTED`, `INTERNAL_ERROR`.
- F2.2 [Error response format] The shown message comes from the frontend table, never from the API `message`: a body with `message: 'debug-text-xyz'` → result does not contain `debug-text-xyz`.
- F2.3 Unknown code (`SOMETHING_NEW`) or a body without `code` → the generic fallback message.
- F2.4 [Error response format] `VALIDATION_FAILED` with `details: ['phone must ...', 'name must ...']` → `details` returned in order; without `details` (A-14, malformed JSON) → `details` is `[]`.
- F2.5 [FD-3] Non-JSON body (e.g. an HTML string), `null` body, or a body that is not an object → the "cannot reach" message, not the generic fallback.
- F2.6 [Rejection responses] `SERVICE_BUSY` message tells the customer to try again (retryable 503).
- F2.7 [Look Up Appointments] `APPOINTMENTS_NOT_FOUND` message does not say whether the plate exists (the API gives the same body for unknown plate and plate/phone mismatch): it names neither "plate" nor "phone" as the wrong field.

### Request payloads

Signatures: `buildBookingPayload(form, timezone): BookingRequest` and `buildLookupPayload(form): LookupRequest`.

- F2.8 [HTTP Book Appointment] Booking body has exactly the DTO keys: `name`, `phone`, `licensePlate`, `dealershipId`, `serviceTypeId`, `startTime`, plus `make`, `model`, `overnightConsent` only when set. No other keys (e.g. no `timezone`, no local `date`/`time`).
- F2.9 [ADR-0002 Time handling] `startTime` equals `toUtcIso(form.date, form.time, timezone)`.
- F2.10 `make` / `model` that are empty or whitespace-only are omitted; non-empty values are sent as entered.
- F2.11 [Customer and vehicle resolution] `licensePlate` and `phone` are sent exactly as entered (e.g. `51a-123.45`, `090 123 4567`); normalization stays in the API.
- F2.12 [I-11] `overnightConsent` is `true` when the customer ticked it; omitted otherwise (never sent as `false`).
- F2.13 [HTTP Look Up Appointments] Lookup body is exactly `{ licensePlate, phone }`, values as entered.
