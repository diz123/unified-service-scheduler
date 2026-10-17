# CLAUDE.md — Agent System & Governance Guidelines

## 1. Communication & Language Policy
- **Strict English Only**: Communicate, comment, and generate all code, documentation, commit messages, and explanations strictly in **English**, unless explicitly directed otherwise by the human engineer.

---

## 2. Project Context & Stack
- **Project**: Keyloop Technical Assessment — Scenario A: The Unified Service Scheduler.
- **Role**: Act as a Senior Fullstack Engineer & Software Architect collaborating with the human Tech Lead.
- **Stack**: TypeScript (strict) · NestJS · PostgreSQL · Prisma ORM 7 · pnpm
- **Decision record**: [ADR-0001](docs/adr/0001-tech-stack.md) — Accepted.
- **Architecture**: Layered / Clean Architecture per module-first layout (`src/modules/<module>/` containing `domain/`, `application/`, `infrastructure/`, `presentation/`).

---

## 3. Engineering Reasoning Framework (WHAT -> HOW -> WHY)
When designing components, writing documentation, or proposing solutions, structure reasoning as:
1. **WHAT (Requirements & Invariants)**: The problem being solved, edge cases, functional and non-functional constraints.
2. **HOW (Technical Design)**: Concrete implementation — data schemas, contracts, algorithms, component flows.
3. **WHY (Justification & Trade-offs)**: Why this approach over alternatives, and what is explicitly sacrificed.

---

## 4. Spec-First Gate (Mandatory Pre-Flight Check)
- **Always Consult the Spec First**: Before writing implementation code, modifying schemas, or planning tasks, read and reference `docs/DESIGN.md`.
- **No Spec Drift**: Code and tests must strictly reflect `docs/DESIGN.md`.
- **Spec Updates Before Code**: If a new requirement, missing edge case, or schema change arises, update `docs/DESIGN.md` FIRST and get human confirmation before modifying code.

### 4.1 Project Phases (Sequential Gates)
1. **Spec** — Draft `docs/DESIGN.md`: domain model, invariants, API contracts, assumptions, open questions. Stack-agnostic.
2. **Stack ADR** — Write `docs/adr/0001-tech-stack.md`, evaluating candidates against Section 4.2. Human approves.
3. **Scaffold** — Initialize the project per the accepted ADR. Update Sections 2 and 6 of this file.
4. **Implement** — TDD per Section 8.

- Do NOT scaffold, install packages, or write implementation code before Phase 2 is `Accepted`.
- The current phase MUST be stated at the top of `docs/DESIGN.md`.

### 4.2 Stack Evaluation Criteria (for ADR-0001)
1. **Concurrency guarantee** (weighted highest): Can the database enforce no-overlap for bay and technician at the database level (e.g., exclusion constraints, row-level locks, serializable isolation)?
2. **ORM support for (1)**: Native support vs. raw SQL escape hatches; migration handling.
3. **Testability**: Ability to run real-database concurrency integration tests locally and in CI.
4. **Reviewer setup cost**: Steps required for a reviewer to run the project (e.g., Docker vs. zero-config).
5. **Architecture fit**: Support for layered architecture and DI without fighting the framework.
6. **Delivery time** within the assessment timebox.

The ADR MUST state explicitly which criteria were traded off against each other.

---

## 5. Domain Invariants (Core Business Rules)
1. **Dual-Resource Allocation**: An appointment requires BOTH:
   - An available `ServiceBay` for the entire interval `[startTime, endTime)`.
   - An available, qualified `Technician` whose skills match `ServiceType.requiredSkill` for the entire interval `[startTime, endTime)`.
2. **Overlap Definition**: Two intervals conflict if `existing.startTime < new.endTime AND existing.endTime > new.startTime`. Only appointments in an active status count toward conflicts; cancelled appointments release their resources.
3. **No Double-Booking**: Double-booking is strictly prohibited. Allocation MUST be enforced atomically under concurrent requests. The mechanism is decided in ADR-0001.
4. **Time & Precision**:
   - All timestamps are ISO 8601 UTC.
   - Durations are integer minutes. Money/costs (if any) are integer minor units.
5. **Data Integrity**: Persist a confirmed `Appointment` linking `Customer`, `Vehicle`, `Dealership`, `ServiceType`, `Technician`, and `ServiceBay`.
6. **Status Lifecycle**: Appointment status is modeled as an explicit state machine, never as independent boolean flags.

`docs/DESIGN.md` MUST track the following as resolved rules or open questions:
- Whether bay and technician must belong to the same `Dealership` as the appointment.
- Whether `endTime` is derived server-side from `ServiceType` duration (vs. supplied by the client).
- Dealership/technician working hours and dealership timezone handling.
- Rejection of bookings in the past.

---

## 6. Core Commands
- Dev Server: `pnpm dev`
- Run Tests: `pnpm test`
- Integration & Concurrency Tests: `pnpm test:integration`
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`

---

## 7. Coding & Quality Standards
- **Strictly No `any`**: `strict: true` (includes `noImplicitAny`) and ESLint rule `@typescript-eslint/no-explicit-any: error`. Use explicit types, generics, or `unknown` with type narrowing.
- **Layer Boundaries** (dependencies point inward only: presentation → application → domain; infrastructure implements ports):
  - `domain/` MUST NOT import framework, ORM, or validation-library code (no decorators, no ORM-generated types).
  - `application/` MUST NOT import framework, ORM, or validation-library code either. Use-case inputs/outputs are plain TypeScript types in `application/commands/`.
  - HTTP DTOs and input validation live in `presentation/dtos/` and are mapped to application commands before invoking a use case.
  - Transaction/locking is exposed to `application/` only through ports in `application/ports/`; implementations live in `infrastructure/database/`.
- **Domain Exceptions** mapped to HTTP status codes:

  | Exception                                                         | HTTP                     |
  | ----------------------------------------------------------------- | ------------------------ |
  | `BayUnavailableException`, `TechnicianUnavailableException`       | 409 Conflict             |
  | `VehicleUnavailableException`, `PlatePhoneMismatchException`      | 409 Conflict             |
  | `SkillMismatchException`                                          | 422 Unprocessable Entity |
  | Input validation errors                                           | 400 Bad Request          |
  | `PastStartTimeException`, `OutsideWorkingHoursException`, `OvernightConsentRequiredException` | 400 Bad Request |
  | `ResourceNotFoundException` (dealership, service type)            | 404 Not Found            |
  | `TransactionTimeoutException` (Prisma P2028, lock wait exhausted) | 503 Service Unavailable |
  | `AppointmentsNotFoundException` (Look Up Appointments)            | 404 Not Found            |

- **YAGNI & Simplicity**: Keep the design focused on the core service layer. No distributed-systems complexity unless strictly required.


---

## 8. AI Behavior & Governance Guardrails
1. **Assumptions Policy**:
   - Business rules that affect the domain model, invariants, or API contract: STOP and ASK the human engineer before implementing.
   - Minor details: propose a default, record it under `## Assumptions` in `docs/DESIGN.md` marked `[PENDING APPROVAL]`, and continue. Never assume silently.
2. **Autonomous Action Limits**:
   - **NEVER** run any git command that writes history or remote state: `git add`, `git commit`, `git merge`, `git rebase`, `git push`, `git reset`, `git checkout`/`git switch` of branches, `git stash`, `git tag`.
   - Read-only git commands are allowed: `git status`, `git diff`, `git log`.
   - AI only modifies files in the working tree. Staging, committing, merging, and pushing are performed by the human engineer.
   - **NEVER** execute destructive operations (dropping tables, deleting files) without explicit human confirmation.
   - **Ask Before Adding Dependencies**: No new packages without human approval and clear justification.
3. **Verification Before Assertion**:
   - NEVER declare a task "complete", "fixed", or "working" without running the relevant test/typecheck/lint commands and showing the actual terminal output as evidence.
4. **Test-Driven Development (TDD)**:
   - Write tests first (Red) covering normal paths, edge cases, and resource conflicts.
   - Implement the minimum code to pass (Green).
   - Refactor for cleanliness and type safety.
   - At least one **concurrency integration test** against a real database: N parallel requests for the same slot → exactly one succeeds.
   - NEVER modify or delete an existing test to make it pass without human approval.
5. **Commit Proposals** (AI proposes, human commits):
   - At the end of each task, show `git status` and propose ONE commit message in Conventional Commits format (`feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`).
   - If a task spans multiple logical changes, propose how to split them into atomic commits (which files per commit).
   - Do not execute the commit.
6. **Work Log** (`docs/WORK_LOG.md`) — applies from Phase 1 onward:
   - After each exchange that leads to a decision or a change, append ONE row to the table. Never edit past rows.
   - Get the timestamp by running `date` — do not guess the time.
   - Keep every cell to one short phrase. Summary only, not an audit trail.

     | Time (UTC+7)     | Asked                   | Answered by | Decided                    | Changed        |
     | ---------------- | ----------------------- | ----------- | -------------------------- | -------------- |
     | 2026-10-15 13:51 | Lighter work log format | AI          | One-row table per exchange | CLAUDE.md §8.6 |

7. **Prompt Log** (`docs/PROMPT_LOG.md`) — applies from Phase 1 onward:
   - For every task prompt from the human engineer (a skill invocation such as `/spec-review ..` including its full arguments, or a prompt using the Phase/Task/Scope format), append it VERBATIM under a heading:
     `### YYYY-MM-DD HH:MM — Phase N — <short task title>` (timestamp via `date`).
   - Do not summarize, fix, translate, or reformat the prompt.
   - Skip short conversational replies (e.g., "ok", "yes, go ahead").
   - Never edit or delete past entries.

8. **No Fabrication & No Over-Engineering**:
   - NEVER invent APIs, package names, versions, CLI flags, config options, file contents, or command output.
     If unsure, verify by reading the code/docs or running a command; otherwise say "I don't know" explicitly.
   - Solve only the stated task with the simplest design that satisfies DESIGN.md.
   - No speculative abstractions, generic frameworks, extra layers, or configurability that no current requirement needs.
   - If a more complex approach seems necessary, explain why in 1–2 lines and ask before implementing it.
   - If an agent plugin or mode (e.g., Ponytail) is active, CLAUDE.md takes precedence on any conflict.
     Do not leave plugin-specific markers (e.g., `ponytail:` comments) in code; record shortcuts in `docs/DESIGN.md` → Assumptions instead.

---

## 9. Documentation Conventions
- All docs live in `docs/` (edited with Obsidian, rendered on GitHub).
- Use standard Markdown links with relative paths. NEVER use `[[wikilinks]]` or `![[embeds]]`.
- Diagrams: Mermaid code blocks only.
- Callouts: only GitHub-supported types (`NOTE`, `TIP`, `IMPORTANT`, `WARNING`, `CAUTION`).
- No plugin-specific syntax (e.g., Dataview queries).
- ADRs: `docs/adr/NNNN-kebab-title.md`, status one of `Proposed | Accepted | Superseded`, sections: Context / Options / Decision / Consequences.
- Markdown formatting:
  - Do NOT hard-wrap lines. One paragraph = one line.
  - Leave a blank line before and after headings, lists, tables, and code blocks.
  - Use LF line endings.