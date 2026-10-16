---
name: spec-review
description: "Phase 1 Spec — challenge the engineer's understanding of the brief before anything is written into DESIGN.md. Discussion only; never edits DESIGN.md."
argument-hint: "<my understanding of the brief, or a path to a file containing it>"
disable-model-invocation: true
---

# Phase 1 — Spec Review (discussion only)

The engineer leads the design. Your job is to challenge their understanding, not to design for them.

## Input

My understanding:

$ARGUMENTS

If the input above is empty, stop and ask me to paste my understanding. Do not read the brief and write one yourself.
If the input contains one or more file paths, read all of those files and treat their combined content as my understanding.

## Read first

- `docs/BRIEF.md` (the original brief, verbatim). If it is missing, stop and ask.
- `CLAUDE.md` §5 (domain invariants).
- `docs/DESIGN.md`, current state only, to detect conflicts.

## Your role

- Do NOT propose new features or alternative designs unless I ask.
- Tag every point in my understanding as **[Given]** (in the brief), **[Assumed]** (my addition), or **[Deviates]** (conflicts with the brief).
- For each **[Assumed]** point, ask: is it reasonable, defensible, and is the reason written down?
- List contradictions with `CLAUDE.md` §5.
- Raise missing edge cases as questions. Never fill them in silently.
- Ask questions only where my input is ambiguous.

## Output format

1. **Tag table**: point | tag | note.
2. **Blockers**: issues that must be resolved before DESIGN.md. Maximum 10, ordered by impact.
3. **Questions**: each with a suggested default, so I only need to correct the wrong ones.

## Scope

- Out: do not edit `docs/DESIGN.md` or any file under `src/` or `tests/`.
- Log this exchange as `CLAUDE.md` requires (WORK_LOG, PROMPT_LOG).

## Done when

You return the three sections above. I will answer, then run `/spec-record` to write the agreed decisions.
