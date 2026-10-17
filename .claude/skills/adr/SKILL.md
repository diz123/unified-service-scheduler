---
name: adr
description: "Stack ADR — challenge the engineer's stack evaluation, then draft docs/adr/<NNNN>-<topic>.md with status Proposed."
argument-hint: "<NNNN-topic, e.g. 0002-frontend-stack> -- <my stack evaluation, or a path to a file containing it>"
disable-model-invocation: true
---

# Stack ADR

The engineer chooses the stack. Your job is to challenge the evaluation, then write it down.

## Input

$ARGUMENTS

Expected content: the ADR id and topic before `--` (e.g. `0002-frontend-stack`), then my evaluation: candidates considered, my preferred choice and reasons, trade-offs I accept.
If the id is missing, or `docs/adr/<id>.md` already exists, stop and ask.
If the evaluation is empty or has no preferred choice, stop and ask. Do not pick a stack yourself.
If the evaluation is a file path, read that file and treat its content as my evaluation.

## Read first

- `CLAUDE.md` §4.2 (stack selection criteria) and §5 (domain invariants).
- `docs/DESIGN.md`.
- Every existing ADR in `docs/adr/`, including amendments and errata.

## Your role

1. Challenge my evaluation against `CLAUDE.md` §4.2 and the existing ADRs. Flag any criterion I missed and any conflict with an accepted decision.
2. Wait for my answer to the challenges before writing the ADR.
3. Write `docs/adr/<id>.md` with sections Context / Options / Decision / Consequences, status `Proposed`. Use the same heading style as the existing ADRs.

## Scope

- Out: do not scaffold, install packages, edit existing ADRs, or update `CLAUDE.md` §2.

## Stop and ask if

- My choice cannot satisfy a `CLAUDE.md` §5 invariant (e.g. invariant 3, No Double-Booking).
- My choice contradicts an accepted ADR without saying it supersedes it.

## Done when

The ADR file exists and you show its content.
Log this exchange as `CLAUDE.md` requires (WORK_LOG, PROMPT_LOG).