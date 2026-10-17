---
name: spec-record
description: "Phase 1 Spec — write decisions the engineer explicitly agreed on into docs/DESIGN.md, only in the named sections, then show the diff."
argument-hint: "<sections to update> -- <agreed decisions>"
disable-model-invocation: true
---

# Phase 1 — Record Agreed Decisions into DESIGN.md

## Input

$ARGUMENTS

The input lists the sections to update and the decisions I agreed on.
If the input contains one or more file paths, read all of those files and treat their combined content as the input.
If either part is missing, stop and ask. Do not infer decisions from earlier conversation that I did not restate here or in the given files.
If a file marks any decision as not agreed, proposed, or `PENDING`, stop and list those decisions; record nothing until I confirm.

## Read first

- `docs/DESIGN.md`
- `CLAUDE.md` §5 (domain invariants) and §9 (documentation conventions).

## Rules

- Update only the sections I named. Do not touch other sections.
- Write only what I stated. No added rationale, examples, or edge cases of your own.
- Keep each assumption in the form: **Assumption / Reason / Impact if wrong / Phase**, when I provided those parts.
- Keep the **[Given] / [Assumed]** tags.

## Stop and ask if

- A decision conflicts with existing content in `docs/DESIGN.md` or with `CLAUDE.md` §5.
- A decision needs a section that does not exist yet.

## Done when

Show `git diff docs/DESIGN.md`. Do not stage or commit; propose a commit message for me to run.
Log this exchange as `CLAUDE.md` requires (WORK_LOG, PROMPT_LOG).
