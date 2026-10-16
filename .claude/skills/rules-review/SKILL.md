---
name: rules-review
description: "Run the independent project-rules reviewer agent (spec drift, scope, version pins, layer boundaries) on the current git diff. Read-only; never fixes anything. For correctness bugs use the built-in /code-review."
argument-hint: "[optional focus, e.g. a file or concern]"
disable-model-invocation: true
---

# Independent Review

Delegate to the `reviewer` subagent to review the current changes (git diff and untracked files).

Focus, if given: $ARGUMENTS

Rules:
- Show the reviewer's findings table and verdict verbatim.
- Do not fix any finding. Wait for me to decide which findings to act on.
- Do not log this exchange in PROMPT_LOG unless I act on a finding.
