---
name: scaffold
description: "Phase 3 Scaffold — initialize the project per ADR-0001 and create the agreed src/ and tests/ tree, with no business logic, then verify typecheck passes."
argument-hint: "<the agreed folder tree, or a path to a file containing it>"
disable-model-invocation: true
---

# Phase 3 — Scaffold

## Input

Agreed tree:

$ARGUMENTS

If the input is empty, stop and ask for the tree. Do not design a structure yourself.
If the input is a file path, read that file and treat its content as the tree.

## Read first

- `CLAUDE.md` §2 (stack) and §7 (layer boundaries).
- `docs/adr/0001-tech-stack.md` (must have status `Accepted`; if not, stop and ask).

## Rules

- Initialize the project per ADR-0001: root config files the ADR's stack needs (for example `package.json`, `tsconfig.json` in strict mode, test runner config, lint config) and the scripts `typecheck`, `test`, `lint`.
- Create folders under `src/` and `tests/` exactly as the tree. Add `.gitkeep` to empty folders.
- No business logic, no entities.
- No installs beyond what ADR-0001 lists.
- Update `CLAUDE.md` §2 (stack: replace `NOT DECIDED` with the stack from ADR-0001) and §6, as `CLAUDE.md` §4.1 requires. Change only those sections.

## Stop and ask if

- ADR-0001 implies a folder that is not in the tree (for example, ORM-specific directories).
- ADR-0001 does not specify a tool a config file needs (test runner, linter, package manager).

## Done when

Show the tree output matching the agreed structure and `git diff CLAUDE.md`. Run `pnpm verify` and show its full output; it must pass.
Then delegate to the `reviewer` subagent on the current diff and show its findings table and verdict verbatim. Do not fix any finding without my approval.
Do not stage or commit; propose a commit message for me to run.
Log this exchange as `CLAUDE.md` requires (WORK_LOG, PROMPT_LOG).