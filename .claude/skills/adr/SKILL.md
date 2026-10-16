---
name: adr
description: "Phase 2 Stack ADR — challenge the engineer's stack evaluation, then draft docs/adr/0001-tech-stack.md with status Proposed."
argument-hint: "<my stack evaluation, or a path to a file containing it>"
disable-model-invocation: true
---

# Phase 2 — Stack ADR

The engineer chooses the stack. Your job is to challenge the evaluation, then write it down.

## Input

My evaluation:

$ARGUMENTS

Expected content: candidates considered, my preferred choice and reasons, trade-offs I accept.
If the input is empty or has no preferred choice, stop and ask. Do not pick a stack yourself.
If the input is a file path, read that file and treat its content as my evaluation.

## Read first

- `CLAUDE.md` §4.2 (stack selection criteria) and §5 (domain invariants).
- `docs/DESIGN.md`.

## Your role

1. Challenge my evaluation against `CLAUDE.md` §4.2. Flag any criterion I missed.
2. Wait for my answer to the challenges before writing the ADR.
3. Write `docs/adr/0001-tech-stack.md` with sections Context / Options / Decision / Consequences, status `Proposed`.

## Scope

- Out: do not scaffold, install packages, or update `CLAUDE.md` §2.

## Stop and ask if

- My choice cannot satisfy `CLAUDE.md` §5 invariant 3 (No Double-Booking).

## Done when

The ADR file exists and you show its content.
Log this exchange as `CLAUDE.md` requires (WORK_LOG, PROMPT_LOG).