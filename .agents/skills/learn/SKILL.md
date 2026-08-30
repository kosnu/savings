---
name: learn
description: Apply the repository's canonical learning-extraction policy to eligible review findings or findings explicitly added by the user. Use when the user asks to learn from feedback, prevent recurrence, exclude inapplicable findings, prepare task context, update rules, or says 学習, 原因調査, 除外, タスクコンテキスト, or レビューを次に反映. This skill does not set a Codex Goal or implement product behavior.
---

# Learn

## Purpose

Provide the dedicated entrypoint for extracting and routing learning in AI
Driven Development and harness-task contexts.

`docs/harness/policies/learning-extraction.md` is the sole canonical source for
finding eligibility, execution order, supported-path applicability, cause and
countermeasure analysis, classification, output, update behavior, and Stop
conditions. Do not restate, supplement, or override that workflow in this
skill.

`harness-task` may also extract learning directly. This skill is the dedicated
learning handoff, not the exclusive owner of learning extraction.

## Required Context

Before processing findings:

1. Read `docs/harness/policies/learning-extraction.md` completely.
2. Read `docs/harness/rule-map.json` and the active documents selected for the
   current findings, task context, and intended reflection targets.
3. For review feedback, read
   `docs/harness/policies/review-feedback-classification.md`.
4. For an AI Driven Development context, read
   `docs/ai-driven-development/workflow.md`.

Use GitHub PR or Issue data only when needed to obtain referenced feedback or
the task-context source of truth.

## Authorization Boundary

Invoking this skill authorizes learning extraction only. It does not authorize
setting a Goal, implementing product behavior, or writing to a reflection
target beyond the user's explicit request.

After loading the required context, execute the canonical learning-extraction
policy exactly as written, including its gates, ordering, output contract, and
Stop conditions.
