**Context (facts from the repo)**:
- Backend: NestJS on port 3000, run on the host (ADR-0001 erratum: compose runs Postgres only). No CORS configured in `src/main.ts`.
- Endpoints the UI uses: `GET /dealerships`, `GET /dealerships/:dealershipId/service-types`, `POST /appointments`, `POST /appointments/lookup`.
- `POST /appointments` takes `startTime` as an ISO-8601 UTC instant with `Z` suffix and zero seconds/ms (Assumption 13). Dealerships carry `openTime`/`closeTime` as local `HH:mm` plus `timezone` (seed: `Asia/Ho_Chi_Minh`).
- Errors come back as `{statusCode, code, message, details?}`; the UI maps `code` to a user-friendly message and preserves form state on rejection (`DESIGN.md` line 225).
- Scope: one page providing the appointment booking flow and appointment lookup (`DESIGN.md` lines 28, 240–256). Availability is checked on submit; slot listing is next phase.
- Root `pnpm-workspace.yaml` holds settings only (`allowBuilds`), no `packages:` list yet.

**Criteria (frontend; adapted from CLAUDE.md §4.2)**:
1. **Delivery time within the assessment timebox** (weighted highest): Minimal boilerplate and fast implementation for a single-page booking + lookup UI.
2. **Zero impact on the verified backend**: Avoid modifying the verified backend (`src/main.ts` has no CORS) or API contracts.
3. **Correct time handling (local wall time -> UTC instant)**: Accurately convert the user's selected date and time in the dealership's IANA `timezone` into an ISO-8601 UTC string (`YYYY-MM-DDTHH:mm:00Z`) without adding heavy third-party date libraries.
4. **Testability**: Pure helper functions (time conversion, error-code mapping) and UI flow can be tested cleanly.
5. **Reviewer setup cost**: Standard `pnpm` commands with minimal extra setup steps.

**Candidates considered**:
- **Framework**: Next.js (App Router, React, TypeScript strict) vs. Vite + React SPA.
- **Repo layout**: `frontend/` directory as a pnpm workspace package (adding `packages: ['.', 'frontend']` or `['frontend']` in `pnpm-workspace.yaml`) vs. standalone `frontend/package.json`.
- **API access**: Next.js built-in `rewrites` proxy (`/api/:path*` -> `http://localhost:3000/:path*` on port 3001) vs. enabling CORS in backend `src/main.ts`.
- **Time handling**: Browser-side conversion using native `Intl.DateTimeFormat` (using the dealership's `timezone` from `GET /dealerships`, matching the backend's zero-dependency `Intl` approach in `working-hours.ts`) vs. third-party timezone library (`date-fns-tz` / `luxon`) vs. changing the backend API contract.
- **Testing**: Unit tests for pure frontend helpers (timezone conversion, error-code mapping, payload formatting) + Playwright/integration smoke test for the booking and lookup flow.

**My preferred choice**:
- **Framework**: Next.js (App Router, Client Components for the interactive forms, TypeScript `strict: true`, no `any`).
- **Repo layout**: `frontend/` package in the pnpm workspace so dependency installation is unified under `pnpm install`.
- **API access**: Next.js `rewrites` in `next.config.ts` proxying `/api/*` to the NestJS backend (`http://localhost:3000/*`), running Next.js on port `3001`. Zero changes to backend `src/main.ts`.
- **Time handling**: Pure TypeScript helper using native `Intl.DateTimeFormat` to convert `(date, time, dealership.timezone)` into a minute-aligned UTC `Z` string (`YYYY-MM-DDTHH:mm:00.000Z`), keeping zero date-library dependencies.
- **Styling**: Plain CSS / CSS Modules (zero Tailwind/UI-library setup overhead).
- **Testing**: Jest unit tests for the pure time-conversion and error-mapping functions.

**Evaluation against criteria**:
1. **Delivery time**: Next.js provides out-of-the-box TypeScript strict mode, routing, and API rewrites in a single config file, allowing immediate focus on the booking and lookup forms.
2. **Zero backend impact**: Built-in `rewrites` eliminate CORS issues without touching `src/main.ts` or re-opening backend review rounds.
3. **Correct time handling**: Reusing the same native `Intl.DateTimeFormat` offset technique already proven in `src/modules/scheduling/domain/working-hours.ts` guarantees 100% consistency between frontend and backend without extra dependencies.
4. **Testability**: Extracting time conversion and API error mapping into pure `.ts` modules makes them directly testable with the existing Jest runner.
5. **Reviewer setup cost**: Single `pnpm install` at the root and a single script (`pnpm --filter frontend dev` or root `pnpm dev:frontend`).

**Trade-offs I accept**:
1. **Next.js framework footprint over a lighter Vite bundle**: Next.js includes SSR/RSC capabilities that a single-page form does not strictly need, which increases `node_modules` size and build time slightly compared to Vite. I accept this because Next.js's built-in `rewrites` proxy, zero-config TypeScript integration, and familiarity save setup time and avoid touching the backend for CORS.
2. **Client-side `Intl` conversion over changing the API contract**: The API contract (`DESIGN.md` Assumption 13) is already implemented and verified; converting local dealership time to UTC in the client preserves the backend contract unchanged.

**Options considered and rejected**:
- **Vite + React — rejected.** Lighter runtime, but requires separate Vite dev-proxy configuration and additional TypeScript/ESLint wiring; familiarity with Next.js yields faster delivery within the remaining timebox. Revisit if bundle size or static-only hosting becomes a hard constraint.
- **Enabling CORS in `src/main.ts` — rejected.** Modifies verified backend code and requires environment-specific origin configuration. Next.js `rewrites` keep requests same-origin with zero backend changes. Revisit if the frontend is deployed to a separate CDN domain without edge rewrites.
- **Third-party timezone library (`date-fns-tz` / `luxon`) — rejected.** Unnecessary dependency (`CLAUDE.md` §8.2) when native `Intl.DateTimeFormat` already handles IANA timezone offsets cleanly in both Node 24 and modern browsers. Revisit if complex recurring calendar widgets are added in a future phase.