---
name: context-scout
description: Bounded repository discovery for a complex independent investigation whose value justifies delegation under AGENTS.md. Do not use for routine searches or small local checks.
argument-hint: "[scope or question]"
---

# Context Scout

## Purpose

Find and summarize the smallest useful repository context for a main executor.

Use this skill with `.codex/agents/context-scout.toml` only when the cost-benefit conditions in AGENTS.md are met. State the independent question and why delegation is worth the added context and integration cost. A Goal needing repository discovery or a cheaper model being available is not sufficient.

Do not make product decisions, final design decisions, file edits, GitHub writes, git writes, or Stop-condition judgments.

## Inputs

The caller should provide:

- The target Goal phase or task.
- Known issue, PR, branch, or artifact paths.
- The suspected app or docs area.
- The exact question to answer.

If the input is too broad, return the missing boundary instead of widening the search.

## Allowed Work

- Select candidate docs from `docs/harness/rule-map.json`.
- Scan Markdown front matter for `area`, `applies_to`, `topics`, `when_to_read`, and `status`.
- Find related files with targeted `rg` queries.
- Summarize existing implementation or documentation patterns.
- Identify likely affected files.
- Summarize verification failures from provided logs.

## Output Contract

Return only concise findings. Do not paste raw logs, full source, or full document bodies.

Use this shape:

```md
## Findings
- <finding> - <file path or command evidence>

## Selected refs
- <id or path>: <short reason>

## Risks / gaps
- <risk or missing input>

## Suggested packet items
- Scope: <short scope material>
- Constraints: <short constraint material>
- Stop checks: <short stop material>
- Verification expectations: <short verification material>
```

## Stop

Stop and report the missing boundary when:

- The task does not name a phase, artifact, issue, PR, path, or domain clearly enough to search narrowly.
- The selected docs conflict and the conflict cannot be resolved from `depends_on`, `overrides`, or `priority`.
- The requested work requires edits, product decisions, final design decisions, git writes, GitHub writes, or user-facing conclusions.
