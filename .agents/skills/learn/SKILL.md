---
name: learn
description: Extract reusable learnings from review comments, verification findings, operational findings, changed constraints, or policy updates, then route each finding to task-context additions or changes, rule or policy additions or changes, or sharpening an existing rule. Use in AI Driven Development or harness-task contexts when the user asks to learn from feedback, prepare task context, update rules, or says 学習, タスクコンテキスト, or レビューを次に反映. This skill does not set a Codex Goal or implement product behavior.
---

# Learn

## Purpose

Extract reusable learning and route each finding to one primary destination:

- Task context addition or change: task-specific intent, scope, constraints, success criteria, or oversight context used as Requirements material or harness-task input.
- Rule / policy addition or change: new durable guidance, or a change to an existing rule's meaning, applicability, or ownership.
- Existing rule / policy sharpening: clarify normal behavior, responsibility, terminology, or a decision boundary without changing the rule's meaning or applicability.

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

Do not update Requirements / PRD or Design Doc. Return task-context additions or
changes as a handoff for the next Requirements Goal or harness task.

When the user explicitly asks to apply a rule or policy addition, change, or
sharpening and the target is unambiguous, update that canonical document.
Otherwise, return a handoff that identifies the proposed rule target and
content. A classification-only result is not an applied rule change.

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

Classify each reusable finding by one primary destination:

- Task context addition or change: task intent, scope, constraints, success criteria, or oversight context needs revision.
- Rule / policy addition or change: durable guidance must be introduced, or an existing rule's meaning, applicability, or ownership must change.
- Existing rule / policy sharpening: an existing rule remains correct but its normal behavior, responsibility, terminology, or decision boundary needs to be more precise.

If task context depends on a new or changed rule, make the primary
classification explicit and state the reference dependency instead of
duplicating the same content.

Do not classify task-local, already represented, unsupported, or non-reusable
findings as learning. Keep them associated with the input and state why they do
not produce a learning change.

Preserve the user's finding and stated reason before adding interpretation. If
an interpretation would introduce visible information, an operation, a
constraint, or a success criterion that the feedback did not state, stop
instead of inferring it.

## Output

Return a concise handoff organized by finding, not a flat list grouped by
destination:

```md
# Learn結果

## 学び

### <finding>

- 明示された理由:
- 振り分け: タスクコンテキストの追加・変更 | ルールの追加・変更 | 既存ルールのsharp化
- 反映先:
- 変更:
- 参照関係:

## 学びにしないfinding

### <finding>

- 理由:
```

Omit empty fields and sections. Account for every supplied finding, preserve
the relationship between each finding and its destination, and do not repeat
the same learning under multiple headings.

When an explicit rule or policy update was completed, return a concise outcome
report with the changed canonical files, extracted learning, verification, and
any remaining task-context handoff.

## Stop

Stop before producing a handoff or updating a rule when:

- The feedback or finding is ambiguous.
- The task whose context should change is missing and cannot be inferred.
- The primary destination cannot be selected from the three classifications.
- A rule or policy addition, change, or sharpening is required but the canonical target is ambiguous.
- The learning cannot be explained without relying on previous implementation code, previous UI behavior, current diff shape, or previous implementation-specific design choices.
- The result violates or may violate the selected rule-map subgraph.
- Memory update is needed but the user did not explicitly request it.

When a Stop condition applies, return only the concrete blocker and the smallest missing input. Do not return a completed Learning Handoff with an unresolved Stop condition embedded in it.
