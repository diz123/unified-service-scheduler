---
name: scaffold
description: "Scaffold — initialize a project part per an Accepted ADR and create the agreed folder tree, with no business logic, then verify it passes."
argument-hint: "<NNNN-adr-id, e.g. 0002-frontend-stack> -- <target root, e.g. frontend/ or . for the repo root> -- <the agreed folder tree, or a path to a file containing it>"
disable-model-invocation: true
---

# Scaffold

## Input

$ARGUMENTS

Expected content, separated by `--`: the ADR id, the target root, and the agreed tree.
If any part is missing, stop and ask. Do not design a structure yourself.
If the tree is a file path, read that file and treat its content as the tree.

## Read first

- `CLAUDE.md` §2 (stack), §6 (commands) and §7 (layer boundaries).
- `docs/adr/<id>.md` (must have status `Accepted`; if not, stop and ask).
- Every other ADR in `docs/adr/`, so nothing you add conflicts with an accepted decision (versions, tooling, version policy).

## Rules

- Initialize the project part per the ADR: config files its stack needs (for example `package.json`, `tsconfig.json` in strict mode, test runner config, lint config) inside the target root, and the scripts `typecheck`, `test`, `lint` (plus any the ADR names).
- Create folders under the target root exactly as the tree. Add `.gitkeep` to empty folders.
- Change files outside the target root only where the ADR names them (for example `pnpm-workspace.yaml`, the root `verify` script, the root ESLint ignore list). List each such change in the report.
- No business logic, no entities, no UI beyond what the framework's init needs to build.
- No installs beyond what the ADR lists. Follow the ADR's version policy: latest stable, verified against official docs, exact versions pinned.
- If the ADR lists compatibility checks for scaffold time, run each against official docs before installing and report the result with its source.
- Record the pinned versions in the ADR's "Pinned versions" section. Change no other part of the ADR.
- Update `CLAUDE.md` §2 (add this part's stack and ADR link; replace `NOT DECIDED` if present) and §6 (add this part's commands), as `CLAUDE.md` §4.1 requires. Change only those sections.

## Stop and ask if

- The ADR implies a folder that is not in the tree (for example, ORM- or framework-specific directories).
- The ADR does not specify a tool a config file needs (test runner, linter, package manager).
- A compatibility check fails, or a needed change outside the target root is not named in the ADR.

## Done when

Show the tree output for the target root matching the agreed structure, the list of changes outside it, and `git diff CLAUDE.md`. Run `pnpm verify` and show its full output; it must pass.
Then delegate to the `reviewer` subagent on the current diff and show its findings table and verdict verbatim. Do not fix any finding without my approval.
Do not stage or commit; propose a commit message for me to run.
Log this exchange as `CLAUDE.md` requires (WORK_LOG, PROMPT_LOG).
