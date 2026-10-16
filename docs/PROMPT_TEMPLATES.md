# Prompt Templates

Reusable task prompts for working with the AI agent on this project.
Rules already defined in `CLAUDE.md` (no `any`, layer boundaries, git limits, work log) are NOT repeated here.

Phase prompts now live as skills in `.claude/skills/`. Each skill is the single source of truth for its phase; this file only indexes them. All skills use `disable-model-invocation: true`, so only the engineer can invoke them.

---

## 0. Base Structure (ad-hoc tasks without a skill)

```markdown
**Phase**: <current phase from DESIGN.md>
**Task**: <one clear goal>
**Scope**:
- In: <what to do>
- Out: <what NOT to touch>
**References**: <files/sections to read first>
**Done when**: <concrete, verifiable criteria>
**Stop & ask if**: <conditions requiring human decision>
```

---

## 1. Phase Skills

| Phase | Skill | Usage |
|---|---|---|
| 1 — Spec | `/spec-review` | `/spec-review <my understanding, or a file path>` |
| 1 — Spec | `/spec-record` | `/spec-record <sections> -- <agreed decisions>` |
| 2 — Stack ADR | `/adr` | `/adr <my stack evaluation, or a file path>` |
| 3 — Scaffold | `/scaffold` | `/scaffold <agreed tree, or a file path>` |
| 4 — Implement | `/tdd-red` | `/tdd-red <feature> -- <test cases> -- <test path>` |
| 4 — Implement | `/tdd-green` | `/tdd-green <feature> -- <files or layers allowed>` |
| 4 — Implement | `/tdd-refactor` | `/tdd-refactor <files> -- <concerns>` |

To change a phase prompt, edit its `SKILL.md`, not this file.
