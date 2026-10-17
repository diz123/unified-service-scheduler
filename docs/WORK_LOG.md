# Work Log

| Time (UTC+7) | Asked | Answered by | Decided | Changed |
|---|---|---|---|---|
| 2026-10-15 16:57 | Bootstrap docs workspace | AI | Six-section DESIGN skeleton | docs/DESIGN.md, docs/WORK_LOG.md, docs/adr/ |
| 2026-10-16 15:56 | /spec-review understanding.md assumptions.md | AI | 15-point tag table, 10 blockers, 10 questions produced; awaiting engineer answers | — |
| 2026-10-16 15:56 | Answers: Q3, Q4, Q8, FQ1, FQ2 | Engineer | Working-hours model confirmed; per-dealership hours+tz; tech preference = same-day overlap count, fixed-order tiebreak | — |
| 2026-10-16 15:56 | /spec-record — all six sections | AI | DESIGN.md fully populated: Overview, Domain Model, 12 Invariants, API Contract, 10 Assumptions, OQ-1 | docs/DESIGN.md |
| 2026-10-16 15:56 | /spec-record — OQ-1 + overnightConsent | AI | OQ-1 resolved: Confirmed+Cancelled schema; overnightConsent optional bool default false | docs/DESIGN.md |
| 2026-10-16 15:56 | /spec-record — I-11 reword | AI | I-11 reworded: optional bool default false, only checked when endTime on later local date | docs/DESIGN.md |
| 2026-10-16 17:21 | /spec-record — replace assumption 5 (Scale) | AI | Scale assumption expanded: ~3–5M vehicles, ~500 dealerships, ~1.2/s avg / ~12/s peak writes, contention local | docs/DESIGN.md |
| 2026-10-16 18:04 | /adr stack-evaluation.md — 4 challenges answered | AI + Engineer | ADR-0001 written: NestJS + PostgreSQL + Prisma, Proposed | docs/adr/0001-tech-stack.md |
| 2026-10-16 18:04 | Approve @prisma/adapter-pg | Engineer | Dependency approved; added at Phase 3 scaffold | docs/adr/0001-tech-stack.md |
| 2026-10-16 18:56 | /scaffold docs/drafts/scaffold-tree.md | AI | Phase 3 complete: tree created, pnpm install clean, pnpm typecheck passes | src/, prisma/, tests/, package.json, tsconfig.json, CLAUDE.md §2+§6 |
| 2026-10-16 18:10 | Fix broken Markdown formatting | AI | No hard-wrap, LF line endings via CLAUDE.md + .editorconfig + .gitattributes | CLAUDE.md §9, .editorconfig, .gitattributes |
| 2026-10-16 18:12 | Unwrap hard-wrapped lines in docs | AI | Joined wrapped paragraphs/list items; content unchanged | docs/DESIGN.md, docs/adr/0001-tech-stack.md |
| 2026-10-16 19:23 | Phase 3 fix: pin versions, fix jest/prisma/tsconfig, add docker-compose | AI | All 5 checks pass; TS pinned 6.0.3; ADR versions table updated | package.json, tsconfig.json, prisma/schema.prisma, prisma.config.ts, docker-compose.yml, docs/adr/0001-tech-stack.md |
| 2026-10-16 22:03 | Add review layer (verify script, reviewer agent, /rules-review) and fix review findings 3–4 | Engineer (with external Claude chat) | Reviewer runs after scaffold/tdd-green/tdd-refactor; read-only hook blocks write flags; /rules-review logs per §8.7 | .claude/agents/reviewer.md, .claude/hooks/reviewer-allow-bash.js, .claude/skills/rules-review/SKILL.md |
| 2026-10-16 22:07 | Fix review findings M-5, M-6, M-7 | AI | postgres:18.6-alpine3.24; @types/node 24.19.2; engines + packageManager; eslint . also parses root/.claude JS (reported, not changed) | docker-compose.yml, package.json, pnpm-lock.yaml, docs/adr/0001-tech-stack.md |
| 2026-10-17 02:25 | /spec-record phase 4, frontend, seed, read-only API | Engineer | Phase 4; backend first, frontend + seed added; slot listing next phase; 3 read-only list ops | docs/DESIGN.md |
| 2026-10-17 02:48 | /spec-record customer/vehicle created at booking | Engineer | Plate+phone identify customer; seed = master data only; Look Up Appointments added; plate/phone mismatch 409 | docs/DESIGN.md |
| 2026-10-17 02:52 | Resolve Non-goals conflict; tag and Assumption 1 wording | Engineer | Drop "(caller identity is known)" and "customer login"; Vehicle [Assumed + Resolved]; Assumption 1 says plate entered | docs/DESIGN.md |
| 2026-10-17 03:03 | /spec-record I-13, 404s, validation order | Engineer | I-13 start within working hours (400); unknown dealership/service type 404; 8-step validation order | docs/DESIGN.md |
| 2026-10-17 07:42 | /spec-record docs/drafts/spec-record-decisions.md | AI | Stopped: file marked NOT yet agreed; Q1–Q3 overlap/conflict with recorded spec; nothing recorded | docs/PROMPT_LOG.md, docs/WORK_LOG.md |
| 2026-10-17 07:55 | /spec-record docs/drafts/spec-record-decisions.md (agreed Q4–Q16) | Engineer | Name-order allocation; workload date; Z + minute-aligned startTime; past = <= now; no midnight/DST; plate/phone rules; 2 exception names | docs/DESIGN.md |
| 2026-10-17 08:24 | /tdd-red Round 1 working-hours & time rules | AI | 12 tests T1.1–T1.12 red on Not implemented; domain stubs; tsconfig types [node, jest] for TS 6 | tests/unit/scheduling/working-hours.spec.ts, src/modules/scheduling/domain/*, tsconfig.json |
| 2026-10-17 08:31 | /tdd-green Round 1 working-hours & time rules | AI | Intl-based tz conversion, no new deps; 12/12 green; pnpm verify passes | src/modules/scheduling/domain/working-hours.ts |
