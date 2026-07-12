---
name: learn
description: Extract reusable learnings from review comments, verification findings, operational findings, changed rules, or policy updates in AI Driven Development or harness-task contexts, then route them into task context or durable rules and policies. Use when the user asks to learn from feedback, prepare task context, capture findings for another task, update rules from recurring feedback, or says 学習, タスクコンテキスト, or レビューを次に反映. This skill does not set a Codex Goal or implement product behavior.
---

# Learn

## Purpose

Extract reusable learning and route it to one of these destinations:

- Task context: intent, scope, constraints, success criteria, or oversight context used as Requirements material or harness-task input.
- Rule / policy: durable guidance that should apply across tasks.

Use this skill in both AI Driven Development and harness-task contexts. In an AI Driven Development cycle, task context becomes material for Requirements. In a harness task, the same task context becomes the skill input.

`harness-task` may also extract and apply learning directly. This skill is the dedicated learning handoff and rule-classification workflow, not the exclusive owner of learning extraction.

## Learning Sources

Use only these sources:

- Original Issue or task context.
- Review comments or other explicit feedback.
- Verification findings.
- Operational findings.
- Changed rules or policies.
- Explicit oversight constraints from the user.

Task-local defects, test failures, type errors, lint failures, and call-site adjustments are not automatically reusable learning. Include them only when they reveal changed task context, a durable rule, policy, oversight constraint, or verification expectation.

## Boundaries

Do not set a Goal or implement product behavior.

Do not use these as source of truth for task context or rules:

- Previous implementation code.
- Previous UI behavior.
- Current diff shape.
- Previous implementation-specific design choices.
- Assumptions derived from how the previous implementation happened to work.

Do not inspect implementation files while using this skill. Use the supplied feedback, task context, verification evidence, and selected canonical documents.

When the user explicitly asks to update a named rule or policy and the target is unambiguous, update that canonical document. Otherwise, return a handoff that identifies the proposed rule target and content. Do not write product artifacts unless the user separately asks for that work.

## Required Repository Context

Always read the smallest useful set:

- `docs/harness/policies/learning-extraction.md`
- `docs/harness/rule-map.json`
- Any rule, policy, domain, ADR, or app-specific docs selected from `docs/harness/rule-map.json`

Also read:

- `docs/harness/policies/review-feedback-classification.md` for review feedback.
- `docs/ai-driven-development/workflow.md` when the learning belongs to an AI Driven Development cycle.

Use GitHub PR or Issue data only when needed to read the referenced feedback or task context.

## Classification

Classify each finding by its reusable destination:

- Task context: the task intent, scope, constraints, success criteria, or oversight context needs revision.
- Rule / policy: durable guidance needs creation, update, or explicit reference.
- Exclude: the finding is task-local, already represented, unsupported, or should not affect future work.

A finding may require both destinations only when task context must reference a new or changed rule. State the dependency explicitly instead of duplicating the same content.

## Output

When no rule or policy write was explicitly requested, return only a concise handoff:

```md
# Learning Handoff

## Source

- Task context:
- Feedback or finding:
- Relevant rules:

## Task Context

- Change:
- Reason:

## Rule / Policy

- Target:
- Change:
- Reason:

## Exclude

- Item:
- Reason:
```

Omit empty sections when they add no information. Keep the handoff compact and directly usable as task context.

When an explicit rule or policy update was completed, return a concise outcome report with the changed canonical files, extracted learning, verification, and any remaining task-context handoff.

## Stop

Stop before producing a handoff or updating a rule when:

- The feedback or finding is ambiguous.
- The task whose context should change is missing and cannot be inferred.
- A rule or policy update is required but the canonical target is ambiguous.
- The learning cannot be explained without relying on previous implementation code, previous UI behavior, current diff shape, or previous implementation-specific design choices.
- The result violates or may violate the selected rule-map subgraph.
- Memory update is needed but the user did not explicitly request it.

When a Stop condition applies, return only the concrete blocker and the smallest missing input. Do not return a completed Learning Handoff with an unresolved Stop condition embedded in it.
