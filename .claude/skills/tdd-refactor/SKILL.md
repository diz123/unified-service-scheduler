---
name: tdd-refactor
description: "Phase 4 TDD Refactor — refactor named files for clarity and type safety based on the engineer's concerns, with no behavior or test changes."
argument-hint: "<files> -- <concerns I see>"
disable-model-invocation: true
---

# Phase 4 — TDD Refactor

## Input

$ARGUMENTS

Expected content: the files to refactor, and the concerns I see.
If either is missing, stop and ask. You may list additional concerns as suggestions, but do not act on them unless I approve.

## Read first

- The files I named and their tests.
- `CLAUDE.md` §7 (layer boundaries).

## Rules

- No behavior change.
- No test changes.

## Stop and ask if

- A refactor would change public contracts or behavior.

## Done when

Show `pnpm test`, `pnpm typecheck`, and `pnpm lint` output, all passing.
Do not stage or commit; propose a commit message for me to run.
Log this exchange as `CLAUDE.md` requires (WORK_LOG, PROMPT_LOG).
