# Observability — Test Case List (rev 2)

Sources: `docs/DESIGN.md` section Observability (O-1 to O-5), `docs/BRIEF.md` Challenge Structure ("Build For the Future … observability").

Scope: request IDs, one access-log entry per request, JSON logs, and the health endpoint. Metrics and tracing are strategy only (O-5) and have no tests.

Commands: unit `pnpm test`; integration `pnpm test:integration`; typecheck `pnpm typecheck`; lint `pnpm lint`.

No new packages: use `@nestjs/common` `ConsoleLogger` / `Logger` and `node:crypto` `randomUUID`. Request and response bodies are never logged.

## Round 8a — Unit: request ID, access-log entry, health check (no DB)

Files: `tests/unit/shared/request-id.spec.ts`, `tests/unit/shared/access-log.spec.ts`, `tests/unit/shared/health.spec.ts` — run with `pnpm test`.

Allowed: `src/shared/**`, `src/app.setup.ts`, `src/app.module.ts`, `src/main.ts`, `tests/unit/shared/**`.

- T8.1 [O-2] A valid incoming `X-Request-Id` is reused: a UUID; a 64-character value of letters, digits, `.`, `_` and `-` (one test each).
- T8.2 [O-2] An invalid incoming value is replaced by a new UUID v4: empty string; 65 characters; contains a space; contains a newline (one test each).
- T8.3 [O-2] A missing header yields a new UUID v4, and two calls yield different IDs.
- T8.4 [O-3] The access-log entry has exactly `requestId`, `method`, `path`, `statusCode`, `durationMs` for a success, and also `code` when the response is an error with a `code`.
- T8.4c [O-3] A 200 response whose body happens to contain `code` produces an entry without `code` (code is read only from error responses).
- T8.5 [O-3] `path` excludes the query string (`/dealerships?x=1` → `/dealerships`).
- T8.6 [O-3] Log level: `log` for status 201 and 409; `error` for status 500 and 503 (one test each).
- T8.7 [O-4] The health check returns `{ status: 'ok' }` when the database ping succeeds.
- T8.8 [O-4] The health check raises the `DATABASE_UNAVAILABLE` error (mapped to 503) when the database ping fails: the response body is the standard error body (`statusCode` 503, `code`, `message`) without the ping error message, and the ping error message is logged at `error` level (spy on `Logger`, which also keeps the test output clean). One test per outcome.

## Round 8b — Integration: HTTP (real PostgreSQL)

File: `tests/integration/observability/observability.http.spec.ts` — run with `pnpm test:integration`.

Allowed: `src/**` (observability wiring only), `tests/integration/observability/**`, `tests/integration/support/**`.

- T8.9 [O-2] Every response carries an `X-Request-Id` header: a 201 booking, a 400 validation error, a 404 unknown route (one test each).
- T8.10 [O-2] A valid incoming `X-Request-Id` is echoed unchanged; an invalid one is replaced.
- T8.11 [O-3] Exactly one access-log entry is written per request, with the same `requestId` as the response header and the response status.
- T8.12 [O-3] A 409 `BAY_UNAVAILABLE` booking and a 404 `ROUTE_NOT_FOUND` produce entries that include `code` (one test each).
- T8.13 [O-3] No log entry written during a booking or a lookup contains that request's `phone`, `licensePlate` or `name`.
- T8.14 [O-3] An unexpected error (the existing failing unit-of-work stub) produces an access-log entry at `error` level with `code` `INTERNAL_ERROR`; the response still carries `X-Request-Id`.
- T8.15 [O-4] `GET /health` returns 200 with exactly `{ "status": "ok" }`.
- T8.16 [O-1] A message written through the logger that `main.ts` uses is a single line of valid JSON containing the message and its context (capture `process.stdout.write`). `main.ts` gets the logger from one exported factory so the test and the app use the same configuration.
