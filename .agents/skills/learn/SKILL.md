---
name: learn
description: Extract learning from review comments, verification findings, operational findings, changed constraints, or policy updates, then route every supplied finding to task-context additions or changes, rule or policy additions or changes, or sharpening an existing rule. Use in AI Driven Development or harness-task contexts when the user asks to learn from feedback, prepare task context, update rules, or says 学習, タスクコンテキスト, or レビューを次に反映. This skill does not set a Codex Goal or implement product behavior.
---

# Learn

## Purpose

Treat every supplied finding as learning and route it to one primary
destination:

- Task context addition or change: task-specific intent, scope, constraints, success criteria, or oversight context. In AIDD, return a concrete target Issue body change; in a harness task, use it as task input.
- Rule / policy addition or change: new durable guidance, or a change to an existing rule's meaning, applicability, or ownership.
- Existing rule / policy sharpening: clarify normal behavior, responsibility, terminology, or a decision boundary without changing the rule's meaning or applicability.

Use this skill in both AI Driven Development and harness-task contexts. In an
AI Driven Development cycle, the Issue body is the Task Context source of
truth. A Learn result is only a proposed Issue body change until it is applied
to that Issue. In a harness task, the same task context becomes the skill input.

`harness-task` may also extract and apply learning directly. This skill is the dedicated learning handoff and rule-classification workflow, not the exclusive owner of learning extraction.

## Learning Sources

Use only these sources:

- Original Issue or task context.
- Review comments or other explicit feedback.
- Verification findings.
- Operational findings.
- Changed rules or policies.
- Explicit oversight constraints from the user.

Treat every finding supplied to this skill as an improvement signal, including
findings already covered by an existing rule.

## Boundaries

Do not set a Goal or implement product behavior.

Do not use these as source of truth for task context or rules:

- Previous implementation code.
- Previous UI behavior.
- Current diff shape.
- Previous implementation-specific design choices.
- Assumptions derived from how the previous implementation happened to work.

Do not inspect implementation files while using this skill. Use the supplied feedback, task context, verification evidence, and selected canonical documents.

Do not update Requirements / PRD or Design Doc. In AIDD, return task-context
additions or changes as concrete edits to the identified Issue body. They do
not become Requirements input until applied to the Issue. In a harness task,
return them as the next task input.

When the user explicitly asks to apply an AIDD task-context change and the
target Issue is unambiguous, update that Issue body and refetch it for
confirmation. Do not apply it to an artifact, policy, or implicit conversation
context instead.

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

Classify each supplied finding by one primary destination:

- Task context addition or change: task intent, scope, constraints, success criteria, or oversight context needs revision. For AIDD, identify the target Issue and the exact body change.
- Rule / policy addition or change: durable guidance must be introduced, or an existing rule's meaning, applicability, or ownership must change.
- Existing rule / policy sharpening: an existing rule remains correct but its normal behavior, responsibility, terminology, or decision boundary needs to be more precise.

If task context depends on a new or changed rule, make the primary
classification explicit and state the reference dependency instead of
duplicating the same content.

When an existing rule already covers the finding, route it to a rule / policy
addition or change if its meaning, applicability, or ownership must change;
otherwise route it to existing rule / policy sharpening.

For a finding caused by a rule or workflow omission, perform the policy's
root-cause check before choosing the destination. If the invariant is
machine-detectable, do not treat prose or self-reported Coverage alone as the
completed learning. Name the owning structured field, validator, and regression
test needed to close equivalent paths. Keep Issue literal evidence, Design
implementation surfaces, and Build actual-diff evidence in their owning phases;
do not repair a later-phase gap by adding technical terms to Task Context.

Preserve the user's finding and stated reason before adding interpretation. If
an interpretation would introduce visible information, an operation, a
constraint, or a success criterion that the feedback did not state, stop
instead of inferring it.

Before routing a finding, state the boundary where its evidence was confirmed,
whether the claimed impact is reachable through an operation the product
actually provides, and whether action is required. A component, hook, or
function test with artificial ordering proves only that local mechanism; it
does not by itself prove an impact that crosses page, auth, network, or user
boundaries. When the supplied evidence does not establish that cross-boundary
operation and only a low-feasibility hypothetical remains, mark the product
response as not required and do not promote it to Task Context or a product
rule. Do not reject a finding merely because its test layer is low; distinguish
the confirmed boundary from the missing reachability evidence.

## Output

Return a concise handoff organized by finding, not a flat list grouped by
destination:

```md
# Learn結果

## 学び

### <finding>

- 明示された理由:
- 根拠境界と実現可能性:
- 対応要否:
- 振り分け: タスクコンテキストの追加・変更 | ルール・ポリシーの追加・変更 | 既存ルール・ポリシーのsharp化
- 反映先:
- 変更:
- 参照関係:
```

For an AIDD task-context finding, write `反映先: Issue #<number>本文` and make
the proposed body change concrete enough to apply without inventing new scope.

Omit empty fields. Account for every supplied finding under `学び`, preserve the
relationship between each finding and its destination, and do not repeat the
same learning under multiple headings.

When an explicit rule or policy update was completed, return a concise outcome
report with the changed canonical files, extracted learning, verification, and
any remaining task-context handoff.

## Stop

Stop before producing a handoff or updating a rule when:

- The feedback or finding is ambiguous.
- The task whose context should change is missing and cannot be inferred.
- An AIDD task-context change has no identifiable target Issue.
- The primary destination cannot be selected from the three classifications.
- A rule or policy addition, change, or sharpening is required but the canonical target is ambiguous.
- The learning cannot be explained without relying on previous implementation code, previous UI behavior, current diff shape, or previous implementation-specific design choices.
- The result violates or may violate the selected rule-map subgraph.
- Memory update is needed but the user did not explicitly request it.

When a Stop condition applies, return only the concrete blocker and the smallest missing input. Do not return a completed Learning Handoff with an unresolved Stop condition embedded in it.
