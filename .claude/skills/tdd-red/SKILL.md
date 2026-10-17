---
name: tdd-red
description: "Phase 4 TDD Red — write failing tests for one feature or use case from the engineer's listed cases. Tests and signature-only stubs, no implementation."
argument-hint: "<feature> -- <test cases I expect: normal, edge, conflict> -- <test path>"
disable-model-invocation: true
---

# Phase 4 — TDD Red: Write Failing Tests

## Input

$ARGUMENTS

Expected content: the feature or use case, the test cases I expect (normal, edge, conflict), and the test path.
If the input contains one or more file paths, read all of those files and treat their combined content as the input.
If a file covers more than one test path, use only the section I named (e.g. "Round 1"); if I did not name one, stop and ask.
If any part is missing, stop and ask. Do not invent test cases I did not list; suggest extra ones as questions.

## Read first

- `docs/DESIGN.md`, the section for this feature.
- `CLAUDE.md` §8.4 (testing rules).

## Rules

- Tests in the test path I gave.
- No implementation code. The only exception: if a test imports a module that does not exist yet, create a minimal stub so TypeScript compiles — exported signatures and types only, every body `throw new Error('Not implemented')`. No logic, no branching, no return values.
- List every stub file you created in your reply, so I can check they contain no logic.
- One test per case I listed; name tests after the business rule they check.

## Stop and ask if

- A test case requires a business rule that is not in `docs/DESIGN.md`.

## Done when

Show the test output with the new tests failing for the expected reason: a failed assertion or the stub's `Not implemented` error — not a syntax, compile, or import error. Typecheck and lint must pass (only the new tests may fail). Use the test, typecheck and lint commands the test-case file names; if it names none, use `pnpm test`, `pnpm typecheck` and `pnpm lint`.
Log this exchange as `CLAUDE.md` requires (WORK_LOG, PROMPT_LOG).