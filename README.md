# Unified Service Scheduler

Keyloop technical assessment, Scenario A: an appointment scheduler that replaces manual booking for dealership service centres. The **backend** (NestJS, PostgreSQL, Prisma) is the implemented service layer. The **Next.js frontend** is the client harness, built only after the backend passed `pnpm verify` ([DESIGN Scope Decision](docs/DESIGN.md#scope-decision-resolved)).

## Highlights

- **No double-booking, proven under concurrency** — a plate advisory lock then a Dealership row lock serialise contenders, and three PostgreSQL exclusion constraints reject any overlap the application misses; integration tests fire 10 parallel bookings at a real database and exactly one wins ([SYSTEM_DESIGN §6](docs/SYSTEM_DESIGN.md#6-availability-and-no-double-booking-i-3)).
- **Working-hours end time** — `endTime` is computed on the server by counting only opening hours; a service that runs into the next day needs `overnightConsent: true`.
- **Automatic allocation** — the first free bay by name and the least-loaded qualified technician, always from the booked dealership.
- **Observability** — JSON logs, an `X-Request-Id` on every response, one access-log line per request with no personal data, and `GET /health`.
- **Tests** — 115 backend unit, 104 frontend unit, 118 integration (real PostgreSQL) and 6 E2E (Playwright).

## Prerequisites

- Docker (only PostgreSQL runs in a container; the API and frontend run on the host, [ADR-0001 erratum](docs/adr/0001-tech-stack.md)).
- Node.js 24 and pnpm 11.
- Free ports: 3000 (API), 3001 (frontend) and 55432 (PostgreSQL, bound to 127.0.0.1 in `docker-compose.yml`).

## Quick start

From a clean clone:

```bash
git clone <repository-url> unified-service-scheduler
cd unified-service-scheduler
pnpm install
cp .env.example .env            # DATABASE_URL (dev) and DATABASE_URL_TEST (tests)
docker compose up -d --wait     # PostgreSQL 18.6 on 127.0.0.1:55432
pnpm prisma generate            # the Prisma client is generated, not committed
pnpm prisma migrate deploy
pnpm db:seed                    # 5 dealerships, 27 bays, 38 technicians, 17 service types
pnpm dev                        # terminal 1: API on http://localhost:3000
pnpm --filter frontend dev      # terminal 2: frontend on http://localhost:3001
```

Check it: `curl http://localhost:3000/health` returns `{"status":"ok"}`. Open http://localhost:3001 to book and look up appointments. Next.js collects anonymous telemetry by default; set `NEXT_TELEMETRY_DISABLED=1` to opt out.

Production build instead of dev servers: `pnpm build && pnpm start` for the API and `pnpm --filter frontend build && pnpm --filter frontend start` for the frontend (`pnpm start` runs `node dist/main`; the E2E run starts both servers this way).

## Try it

The API is at `http://localhost:3000` (the frontend calls it through `/api/*`). Ids come from `SEED_IDS` in [prisma/seed.ts](prisma/seed.ts); times are UTC, and Ben Thanh is open 08:00–17:00 local (UTC+7).

```bash
API=http://localhost:3000
BEN_THANH=00000000-0000-4000-8000-000000000001
OIL=00000000-0000-4000-8000-000000000101     # Oil change, 60 min, Maintenance
BRAKES=00000000-0000-4000-8000-000000000102  # Brake inspection, 90 min, only Tech 01 qualified
EV=00000000-0000-4000-8000-000000000103      # EV battery check, no qualified technician

# book PLATE SERVICE_TYPE START [PHONE] [OVERNIGHT_CONSENT] — prints the body and the HTTP status
book() {
  curl -s -w '  -> HTTP %{http_code}\n' -X POST "$API/appointments" -H 'Content-Type: application/json' \
    -d "{\"name\":\"Demo Customer\",\"phone\":\"${4:-0901234567}\",\"licensePlate\":\"$1\",\"dealershipId\":\"$BEN_THANH\",\"serviceTypeId\":\"$2\",\"startTime\":\"$3\",\"overnightConsent\":${5:-false}}"
}

curl -s -w '\n' "$API/dealerships"                          # 200, 5 dealerships
curl -s -w '\n' "$API/dealerships/$BEN_THANH/service-types" # 200, 3 service types
curl -s -i -w '\n' "$API/health" -H 'X-Request-Id: demo-123' # 200; the response echoes X-Request-Id: demo-123
```

Demo scenarios on a freshly seeded database, run in order (2030-01-15, local time):

| Scenario | Command | Expected |
|---|---|---|
| Success, 10:00 | `book 51A-111.11 $OIL 2030-01-15T03:00:00Z` | 201; the body has the ids of Bay 01 and Tech 01 |
| No bay: the other 3 bays at 10:00, then a 5th car | `for p in 12 13 14; do book 51A-111.$p $OIL 2030-01-15T03:00:00Z; done; book 51A-111.15 $OIL 2030-01-15T03:00:00Z` | 201 three times, then 409 `BAY_UNAVAILABLE` |
| No free technician, 13:00 | `book 51B-222.21 $BRAKES 2030-01-15T06:00:00Z; book 51B-222.22 $BRAKES 2030-01-15T06:00:00Z` | 201, then 409 `TECHNICIAN_UNAVAILABLE` |
| No qualified technician | `book 51C-333.31 $EV 2030-01-15T03:00:00Z` | 422 `NO_QUALIFIED_TECHNICIAN` |
| Overnight, 16:30 | `book 51D-444.41 $OIL 2030-01-15T09:30:00Z; book 51D-444.41 $OIL 2030-01-15T09:30:00Z 0901234567 true` | 400 `OVERNIGHT_CONSENT_REQUIRED`, then 201 ending 08:30 next day (`2030-01-16T01:30:00.000Z`) |
| Wrong phone | `book 51A-111.11 $OIL 2030-01-15T07:00:00Z 0909999999` | 409 `PLATE_PHONE_MISMATCH` |

Look up a vehicle's appointments (POST, so the phone never appears in a URL):

```bash
curl -s -X POST "$API/appointments/lookup" -H 'Content-Type: application/json' \
  -d '{"licensePlate":"51A-111.11","phone":"0901234567"}' -w '  -> HTTP %{http_code}\n'  # 200, newest first
curl -s -X POST "$API/appointments/lookup" -H 'Content-Type: application/json' \
  -d '{"licensePlate":"51A-111.11","phone":"0909999999"}' -w '  -> HTTP %{http_code}\n'  # 404 APPOINTMENTS_NOT_FOUND, same as an unknown plate
```

Every error body is `{ statusCode, code, message, details? }`; the full list of codes is in [SYSTEM_DESIGN §9](docs/SYSTEM_DESIGN.md#9-api-and-errors).

## Tests

| Level | Command | Tests |
|---|---|---|
| Everything except integration and E2E: typecheck, lint, both unit suites, `prisma validate`, both builds | `pnpm verify` | — |
| Backend unit | `pnpm test` | 115 |
| Frontend unit | `pnpm --filter frontend test` | 104 |
| Integration, real PostgreSQL (`scheduler_test`, created by the runner) | `pnpm test:integration` | 118 |
| E2E, Playwright Chromium (needs ports 3000 and 3001 free; run `pnpm exec playwright install chromium` once) | `pnpm test:e2e` | 6 |

Integration and E2E tests share the `scheduler_test` database, so run them one at a time. `pnpm test:integration` prints `ERROR [AccessLog]` and `ERROR [AllExceptionsFilter]` lines (with a stack trace): they come from tests that trigger 500 and 503 on purpose, and the run still passes.

## Project structure

```text
src/modules/scheduling/   booking module: domain, application, infrastructure, presentation layers
src/shared/               shared Prisma client, JSON logger, exception filter, request-ID and health code
prisma/                   schema, migrations (incl. raw-SQL constraints) and seed script
tests/unit/               backend unit tests
tests/integration/        API and database tests on real PostgreSQL
frontend/                 Next.js booking and lookup page (client harness)
e2e/                      Playwright smoke tests
scripts/                  integration-test runner (points tests at DATABASE_URL_TEST)
docs/                     spec, system design, ADRs, test-case lists, prompt and work logs
```

## Documentation

- [System design](docs/SYSTEM_DESIGN.md) — architecture, components, data flow, technologies, observability, GenAI use. [PDF](docs/SYSTEM_DESIGN.pdf): PDF export with the diagrams rendered (the Markdown file is the source of truth).
- [Spec (DESIGN.md)](docs/DESIGN.md) — domain model, invariants, API contract, assumptions.
- [ADR-0001 backend stack](docs/adr/0001-tech-stack.md) and [ADR-0002 frontend stack](docs/adr/0002-frontend-stack.md).
- Test-case lists: [booking API](docs/drafts/book-appointment-test-cases.md), [frontend](docs/drafts/frontend-test-cases.md), [observability](docs/drafts/observability-test-cases.md).
- [Assessment brief](docs/BRIEF.md), [prompt log](docs/PROMPT_LOG.md), [work log](docs/WORK_LOG.md).

## AI Collaboration Narrative

The code and docs were written with Claude Code. The engineer made every decision and every commit; the AI never staged or committed (a hook blocks git write commands). Commits carry no AI co-author trailer because the AI's role is recorded instead: every task prompt is copied verbatim into the [prompt log](docs/PROMPT_LOG.md), and every decision is one row in the [work log](docs/WORK_LOG.md).

### Strategy for guiding the AI

[CLAUDE.md](CLAUDE.md) sets the rules: fixed phases (spec, stack ADR, scaffold, then implement with TDD), the spec before any code, stop and ask on any business rule, no new package without approval, and no claim of "done" without command output. Work was driven through project skills in [.claude/skills](.claude/skills): `/spec-review` challenges the engineer's understanding without editing the spec, `/spec-record` writes only decisions the engineer restated, `/adr` challenges the stack evaluation before writing the ADR, and `/tdd-round` runs one test-case section end to end. From Round 3b on, the engineer drafted or updated the test-case lists in an external Claude chat (the work log records this for the Round 3b update and Rounds 3c, 4c, 5, 6 and 7, 2026-10-17 12:11–18:07), then ran each list under the harness. Example: on 2026-10-16 15:56, `/spec-review` returned 10 blockers and 10 questions; the engineer's answers (working-hours model, per-dealership hours and timezone, technician preference) were recorded with `/spec-record`, together with the two draft files.

### Verifying and refining its output

Every `/tdd-round` round (from Round 3a) has two read-only subagents in [.claude/agents](.claude/agents): `red-gate` checks that new tests fail for the right reason before any implementation, and `reviewer` checks the diff against DESIGN.md, the ADRs and CLAUDE.md. A Critical or Important finding stops the round until the engineer decides. Examples from the work log:

- **2026-10-17 07:42** — `/spec-record` refused to write: the draft file marked its decisions as not yet agreed. Nothing was recorded until the agreed re-run at 07:55.
- **2026-10-17 11:32** — the red gate found that the integration test files, run in parallel by the `test:integration` script the AI wrote at scaffold, truncated each other's shared database. The round stopped; the fix (serial runs) needed a file outside the allowed list, so the engineer decided it.
- **2026-10-17 14:30–14:34** — the reviewer reported an Important finding: framework errors (malformed JSON, 500, unknown route) bypassed the error format. The rule went into DESIGN.md with `/spec-record` before the code changed.

### Ensuring final quality

- One gate, `pnpm verify` (typecheck, lint, unit tests, `prisma validate`, both builds), plus `pnpm test:integration` on real PostgreSQL for every round that touched the database; nothing was called done without its output.
- New tests were mutation-checked where a rule could be deleted without a test failing (for example the lookup phone-normalization test T5.11, 2026-10-17 15:50, and the server-side logging test T4.14b, 15:05, in the work log).
- The no-double-booking rule is enforced by the database itself and proven by concurrency tests, not by review alone.
- Strict TypeScript with `no-explicit-any`, layer boundaries checked by the reviewer, exact version pins, and a [system design](docs/SYSTEM_DESIGN.md) checked line by line against the code and logs by the reviewer subagent.

## Known limitations

No authentication or rate limiting, a booking 409 that reveals a known plate, a dealership lock held for the whole booking, a health ping that is not cancelled after its 2-second timeout, no access-log line when a client disconnects early, and a few frontend and test-setup notes. Details: [SYSTEM_DESIGN §15](docs/SYSTEM_DESIGN.md#15-known-limitations-and-next-steps).
