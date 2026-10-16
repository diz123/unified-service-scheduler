---
name: tdd-green
description: "Phase 4 TDD Green — implement the minimum code to make the current failing tests pass, without modifying tests."
argument-hint: "<feature> -- <files or layers allowed>"
disable-model-invocation: true
---

# Phase 4 — TDD Green: Minimum Implementation

## Input

$ARGUMENTS

Expected content: the feature, and the files or layers you are allowed to change.
If either is missing, stop and ask.

## Read first

- `docs/DESIGN.md`, the section for this feature.
- `CLAUDE.md` §7 (layer boundaries).
- The failing tests for this feature.

## Rules

- Change only the files or layers I allowed.
- Do not modify tests.
- No refactoring beyond what is needed to pass.

## Stop and ask if

- Passing a test seems to require changing the test or the spec.

## Done when

Show `pnpm test` and `pnpm typecheck` output, all passing.
Do not stage or commit; propose a commit message for me to run.
Log this exchange as `CLAUDE.md` requires (WORK_LOG, PROMPT_LOG).
