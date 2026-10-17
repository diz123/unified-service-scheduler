# ADR-0002 — Frontend Stack

**Status**: Accepted

---

## Context

DESIGN.md Target Deliverables includes a booking frontend: one page to book an appointment and look up a vehicle's appointments. Per DESIGN.md Scope Decision, the frontend starts only after the backend is complete and `pnpm verify` passes, and its stack is decided here. ADR-0001 (backend stack) stays in force; this ADR does not supersede any part of it.

**Facts from the repo**:

- Backend: NestJS on port 3000, run on the host (ADR-0001 Erratum, local setup: `docker compose up` starts only PostgreSQL). No CORS is configured in `src/main.ts`.
- Endpoints the UI uses: `GET /dealerships`, `GET /dealerships/:dealershipId/service-types`, `POST /appointments`, `POST /appointments/lookup` (DESIGN.md API Contract).
- `POST /appointments` takes `startTime` as an ISO 8601 UTC instant with the `Z` suffix, minute-aligned, with seconds and at most 3 fraction digits (DESIGN.md Validation order step 1, Assumption 13). Dealerships carry `openTime` / `closeTime` as local `HH:mm` plus an IANA `timezone` (seed: `Asia/Ho_Chi_Minh`).
- Errors come back as `{ statusCode, code, message, details? }` (DESIGN.md Error response format). The UI maps `code` to a user-friendly message and keeps the form on rejection (DESIGN.md Frontend handling).
- Scope: booking and lookup on one page. Availability is checked on submit; available time-slot listing is next phase (DESIGN.md Out of Scope for MVP).
- The root `pnpm-workspace.yaml` holds settings only (`allowBuilds`), with no `packages:` list yet.

**Criteria** (frontend, adapted from CLAUDE.md §4.2). CLAUDE.md §4.2 criteria 1–2 (concurrency guarantee, ORM support) are unaffected: the frontend enforces no invariant, and booking, availability and No Double-Booking (I-3) stay in the API.

1. **Delivery time within the assessment timebox** (weighted highest): minimal boilerplate and fast implementation for a single-page booking and lookup UI.
2. **Zero impact on the verified backend**: no change to backend code (`src/`) or the API contract.
3. **Correct time handling** (local wall time → UTC instant): convert the selected date and time in the dealership's IANA `timezone` into the UTC string the API accepts, without a third-party date library.
4. **Testability**: pure helpers (time conversion, error-code mapping) and the UI can be tested cleanly.
5. **Reviewer setup cost**: standard pnpm commands documented in the README.

**Candidates evaluated**:

| Concern | Candidates |
|---|---|
| Framework | Next.js (App Router), Vite + React SPA |
| Repo layout | `frontend/` as a pnpm workspace package, standalone `frontend/package.json` |
| API access | Next.js `rewrites` proxy, CORS enabled in `src/main.ts` |
| Time handling | Native `Intl.DateTimeFormat`, `date-fns-tz` / `luxon`, changing the API contract |
| Testing | Unit tests for pure helpers, Playwright smoke test of the booking and lookup flow |

---

## Options

### Framework

**Next.js (App Router) — chosen.** Client Components for the interactive forms, TypeScript `strict: true`, no `any`. Next.js provides TypeScript integration, routing and API rewrites from a single config file, so work can focus on the booking and lookup forms.

**Vite + React — not chosen.** Lighter runtime and bundle. Vite's dev proxy (`server.proxy`) is comparable in effort to Next.js `rewrites`; the reason for rejection is familiarity with Next.js, which yields faster delivery within the remaining timebox (criterion 1). Revisit if bundle size or static-only hosting becomes a hard constraint.

### Repo layout

**`frontend/` as a pnpm workspace package — chosen.** `pnpm-workspace.yaml` gets `packages: ['frontend']`; the root package is always included in a pnpm workspace (pnpm docs, `packages` setting), so it is not listed. Dependency installation is unified under one root `pnpm install`.

**Standalone `frontend/package.json` — not chosen.** A second install step for reviewers (criterion 5).

### API access

**Next.js `rewrites` — chosen.** `next.config.ts` proxies `/api/:path*` to the NestJS API at `http://localhost:3000/:path*`. Next.js runs on port 3001. Requests stay same-origin, so `src/main.ts` is unchanged (criterion 2). Rewrites need the Next.js server (`next dev` / `next start`); they do not work with `output: 'export'` (Next.js docs), so the frontend is not built as a static export.

**CORS in `src/main.ts` — not chosen.** Modifies verified backend code and needs environment-specific origin configuration. Revisit if the frontend is deployed to a separate domain without edge rewrites.

### Time handling

**Native `Intl.DateTimeFormat` — chosen.** A pure TypeScript helper converts `(date, time, dealership.timezone)` into a UTC instant and serializes it with `Date.toISOString()`, giving `YYYY-MM-DDTHH:mm:00.000Z`, which the API accepts. The helper is a frontend copy of the offset technique in the backend's `src/modules/scheduling/domain/working-hours.ts`, tested against the same cases as the backend. The conversion is correct because all dealerships are in Vietnam with no DST (DESIGN.md Assumption 4).

**`date-fns-tz` / `luxon` — not chosen.** An unnecessary dependency (CLAUDE.md §8.2) when native `Intl.DateTimeFormat` handles IANA timezone offsets in Node 24 and modern browsers. Revisit if complex recurring calendar widgets are added in a future phase.

**Changing the API contract (send local date and time) — not chosen.** The contract is implemented and verified; converting in the client keeps it unchanged (criterion 2).

### Styling

**Plain CSS / CSS Modules — chosen.** No Tailwind or UI-library setup (criterion 1).

### Testing

**Jest unit tests for pure helpers — chosen.** Time conversion, error-code mapping and payload formatting live in pure `.ts` modules. `frontend/` has its own Jest config and `test` script; the root `jest.config.js` (roots `tests/`, root `tsconfig.json`) is not changed.

**Playwright smoke test — deferred.** See Consequences, trade-off 2.

---

## Decision

**Chosen stack: Next.js (App Router) + React + TypeScript strict, in a `frontend/` pnpm workspace package, calling the API through Next.js `rewrites`, with native `Intl` time conversion, plain CSS / CSS Modules, and Jest unit tests.**

**Verification**: the frontend's typecheck, lint, test and build join the root `pnpm verify` script. The root ESLint config ignores `frontend/**`; the frontend is linted by its own config.

**Version policy**: as ADR-0001 — the latest stable release of every dependency as of the frontend scaffold, verified against official docs. No pre-releases. Exact versions are pinned in `pnpm-lock.yaml` and recorded in this ADR when the frontend is scaffolded.

**Pinned versions**: recorded here at the frontend scaffold.

**Compatibility checks at scaffold time** (verify against official docs before pinning):

1. Next.js supports TypeScript 6.0.x (pinned `<6.1.0` in ADR-0001) and Node 24.
2. The frontend ESLint setup works with ESLint 10.12.0 and typescript-eslint 8.71.2 pinned in ADR-0001.
3. Which frontend dependencies need new `allowBuilds` entries in `pnpm-workspace.yaml`.

---

## Consequences

### Positive

- No change to backend code (`src/`) or the API contract (criterion 2). Root configuration changes only: `pnpm-workspace.yaml` (`packages`, any `allowBuilds` entries), the root `pnpm verify` script, and the root ESLint ignore list.
- One `pnpm install` at the root installs backend and frontend.
- The API's validation stays the single source of truth; the frontend only formats input and maps error codes.

### Negative / Trade-offs accepted

1. **Next.js footprint over a lighter Vite bundle** (criterion 1 over runtime size). Next.js includes SSR/RSC capabilities that a single-page form does not need, increasing `node_modules` size and build time compared to Vite. Accepted because familiarity with Next.js and its built-in `rewrites` save setup time and avoid touching the backend for CORS.
2. **Unit tests only, no end-to-end test of the booking and lookup flow** (criterion 1 over criterion 4). The proxy and the kept-form-on-rejection behaviour (DESIGN.md Frontend handling) are not covered by an automated test. Trigger: add a Playwright smoke test, as a separate script outside `pnpm verify`, if time remains after both flows work.
3. **Duplicated time conversion** (criterion 2 over a single shared implementation). The frontend helper is a copy of the backend technique, not shared code; drift is guarded only by testing both against the same cases.
4. **Client-side `Intl` conversion over changing the API contract** (criterion 2 over moving the conversion server-side). The API contract stays unchanged.
5. **Three processes for local setup** (criterion 5 over a single command). A reviewer runs `docker compose up`, the API, and the frontend in separate terminals, documented in the README. No combined runner is added (no new dependency).

### Reviewer notes (README)

- The terminals and commands to start PostgreSQL, the API (port 3000) and the frontend (port 3001).
- Next.js collects anonymous telemetry by default; set `NEXT_TELEMETRY_DISABLED=1` to opt out.
