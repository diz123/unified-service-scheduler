---
name: tdd-round
description: "Phase 4 TDD — run one test-case section end to end: Red, red gate, Green, verify, review. Stops once with one commit proposal; never commits."
argument-hint: "<section name, e.g. Round 3a> -- <test-case file, e.g. docs/drafts/book-appointment-test-cases.md>"
disable-model-invocation: true
---

# Phase 4 — TDD Round (Red → Gate → Green → Review)

## Input

$ARGUMENTS

Expected content: the section to run and the test-case file that contains it.
Read the file and use only the section I named. If the section or the file is missing, or the name matches more than one section, stop and ask.

## Procedure

Run the steps in order. Do not skip a step. Do not ask me between steps unless a stop condition below is hit.

1. **Red** — Read `.claude/skills/tdd-red/SKILL.md` and follow its Rules and Done-when, with this section's cases and test path as the input.
   - Write one `it()` per behavior. If a case lists several outcomes (a, b, c…), write one `it()` per outcome.
   - Record two lists for later: the stub files you created, and the existing source files the new tests import.
2. **Red gate** — Delegate to the `red-gate` subagent, naming the section and the test file. Show its table and verdict verbatim.
   - `Verdict: FAIL` → fix only the tests or stubs the gate flagged, then run the gate once more. A second FAIL is a stop condition.
3. **Green** — Read `.claude/skills/tdd-green/SKILL.md` and follow its Rules.
   - Allowed files: the section's `Allowed:` line if it has one; otherwise the stub files and the imported source files recorded in step 1. Changing any other file is a stop condition.
   - Follow `docs/DESIGN.md` exactly where it defines order (e.g. the Validation order). Do not add behavior the tests and DESIGN.md do not require.
4. **Verify** — Run `pnpm verify`. If the section's test path is under `tests/integration/`, also run `pnpm test:integration`. If a check fails, fix it once and re-run; a second failure is a stop condition.
5. **Review** — Delegate to the `reviewer` subagent on the current diff. Show its findings table and verdict verbatim. Do not fix any finding.

## Fix and re-review

When I reply after a round with findings to fix:

1. Fix only the findings I named, inside the allowed files from step 3.
2. Re-run step 4 (Verify) and step 5 (Review), and show the reviewer table and verdict verbatim.
3. Count re-reviews per round. After the 2nd re-review, stop only for a Critical or Important finding. List any Minor findings under "Deferred" in the report; do not ask me about them and do not fix them.

## Stop and ask if

- A case needs a business rule that is not in `docs/DESIGN.md` (spec gap).
- Passing a test seems to require changing the test or the spec.
- Green needs a file outside the allowed list.
- The red gate fails twice, or `pnpm verify` / `pnpm test:integration` fails twice.
- The reviewer reports a Critical or Important finding (at any review, including re-reviews).

When you stop, report which step stopped, why, and the current state of the working tree.

## Done when

Report, in this order:

1. The red-gate table and verdict, and the reviewer table and verdict (verbatim).
2. The final test summary line(s) from step 4.
3. Tests that already passed at Red, each with one line on why.
4. `git status`, then ONE commit proposal covering Red and Green (Conventional Commits), with a body line: "Red and green for <section> in one commit."

Never stage or commit (CLAUDE.md §8.2).
Log this exchange as `CLAUDE.md` requires: one PROMPT_LOG entry for this invocation, one WORK_LOG row at the end.
