---
name: learn
description: Investigate the causes behind review comments, verification failures, operational findings, changed constraints, or policy updates; compare preventive countermeasures; and route the selected learning to task context or canonical rules and policies. Use in AI Driven Development or harness-task contexts when the user asks to learn from feedback, prevent recurrence, prepare task context, update rules, or says 学習, 原因調査, タスクコンテキスト, or レビューを次に反映. This skill does not set a Codex Goal or implement product behavior.
---

# Learn

## Purpose

Treat every supplied finding as an improvement signal, not as a ready-made
learning or countermeasure. First establish the recurrence to prevent,
investigate the cause, and select the countermeasure that best prevents the
same causal failure. Then route the result to one primary destination:

- Task context addition or change: task-specific intent, scope, constraints, success criteria, or oversight context. In AIDD, return a concrete target Issue body change; in a harness task, use it as task input.
- Rule / policy addition or change: new durable guidance, or a change to an existing rule's meaning, applicability, or ownership.
- Existing rule / policy sharpening: clarify normal behavior, responsibility, terminology, or a decision boundary without changing the rule's meaning or applicability.

The selected countermeasure may target implementation, a contract, ownership,
a workflow, or the execution environment rather than this skill or another
rule. Route such work to task context with the owning surface and required
outcome; do not convert it into a rule merely because Learn produces the
handoff.

Use this skill in both AI Driven Development and harness-task contexts. In an
AI Driven Development cycle, the Issue body is the Task Context source of
truth. A Learn result is only a proposed Issue body change until it is applied
to that Issue. In a harness task, the same task context becomes the skill input.

`harness-task` may also extract and apply learning directly. This skill is the dedicated learning handoff and rule-classification workflow, not the exclusive owner of learning extraction.

## Evidence

Use these sources to establish intended behavior and constraints:

- Original Issue or task context.
- Review comments or other explicit feedback.
- Verification findings.
- Operational findings.
- Changed rules or policies.
- Explicit oversight constraints from the user.

Treat every finding supplied to this skill as an improvement signal, including
findings already covered by an existing rule.

To diagnose why the finding occurred, inspect the smallest useful set of
current implementation, configuration, workflow, ownership, verification, and
execution-environment evidence. Implementation and diff evidence may establish
the causal chain, but they do not define intended behavior or become task
context or a canonical rule by themselves.

## Boundaries

Do not set a Goal or implement product behavior.

Do not use these as source of truth for intended behavior, task context, or
rules:

- Previous implementation code.
- Previous UI behavior.
- Current diff shape.
- Previous implementation-specific design choices.
- Assumptions derived only from how the previous implementation happened to work.

Treat a countermeasure proposed in feedback as a candidate, not as an approved
learning. Do not add a local rule or prohibition until the causal evidence and
alternative countermeasures have been compared.

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

## Cause Investigation And Countermeasure Selection

For each finding, complete these decisions before classification:

1. Separate the observed failure, the stated reason, and any proposed
   countermeasure. Define the recurrence or broken invariant to prevent.
2. Trace the causal chain through the relevant current implementation, existing
   rules and contracts, ownership boundaries, workflow, and execution
   environment. Distinguish a root or control failure from the place where the
   symptom was observed.
3. Compare the applicable countermeasure types without preferring a rule by
   default:
   - add a new rule or policy;
   - change or sharpen an existing rule or policy;
   - change the mechanism, contract, validation, or owning responsibility;
   - fix the execution environment, tooling, or runtime configuration.
4. Select the smallest practical countermeasure at the causal layer that gives
   the strongest recurrence prevention. Consider the range of recurrence it
   covers, whether it prevents or merely reminds, whether it sits with the
   correct owner, its enforceability, side effects, and implementation cost.
5. Identify the canonical owner and concrete reflection target. When the target
   is code, a contract, a workflow, or environment configuration, produce a
   scoped task-context handoff rather than a synthetic rule change.

Do not require evidence from every layer when it cannot affect the finding.
Document why the inspected evidence is sufficient to distinguish the selected
cause and countermeasure from the plausible alternatives.

## Classification

Classify each supplied finding by one primary destination:

- Task context addition or change: task intent, scope, constraints, success criteria, or oversight context needs revision. For AIDD, identify the target Issue and the exact body change.
- Rule / policy addition or change: durable guidance must be introduced, or an existing rule's meaning, applicability, or ownership must change.
- Existing rule / policy sharpening: an existing rule remains correct but its normal behavior, responsibility, terminology, or decision boundary needs to be more precise.

If task context depends on a new or changed rule, make the primary
classification explicit and state the reference dependency instead of
duplicating the same content.

When an existing rule already covers the finding, change it only if the cause
investigation shows that its meaning, applicability, ownership, normal pattern,
or decision boundary is deficient. Choose addition or change when meaning,
applicability, or ownership must change, and sharpening when the intent remains
correct but its expression leaves a causal ambiguity.

When a rule is already correct and the failure came from missing enforcement,
an unclear contract, misplaced ownership, or the execution environment, keep
the rule unchanged and route the selected countermeasure to the owning task
context. A new rule is appropriate only when a durable decision boundary is
missing and a rule can affect the causal decision point.

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
- 防ぐ再発:
- 原因:
- 原因の根拠:
- 比較した対策:
- 選定対策:
- 振り分け: タスクコンテキストの追加・変更 | ルール・ポリシーの追加・変更 | 既存ルール・ポリシーのsharp化
- 反映先:
- 変更:
- 参照関係:
```

For an AIDD task-context finding, write `反映先: Issue #<number>本文` and make
the proposed body change concrete enough to apply without inventing new scope.

Do not omit the recurrence, cause, causal evidence, compared countermeasures,
selected countermeasure, classification, target, or change. Omit only optional
fields that are genuinely absent. Account for every supplied finding under
`学び`, preserve the relationship between each finding and its destination, and
do not repeat the same learning under multiple headings.

When an explicitly authorized update was completed, return a concise outcome
report with the changed canonical files or owning surfaces, extracted learning,
verification, and any remaining task-context handoff.

## Stop

Stop before producing a handoff or updating a rule when:

- The feedback or finding is ambiguous.
- The task whose context should change is missing and cannot be inferred.
- An AIDD task-context change has no identifiable target Issue.
- The primary destination cannot be selected from the three classifications.
- A rule or policy addition, change, or sharpening is required but the canonical target is ambiguous.
- The causal chain or recurrence to prevent cannot be established from the available evidence.
- Plausible countermeasures remain materially tied and choosing one would change scope, behavior, risk, or ownership without user input.
- The selected countermeasure has no identifiable canonical owner or reflection target.
- The intended behavior cannot be explained without treating previous implementation code, previous UI behavior, current diff shape, or previous implementation-specific design choices as authoritative.
- The result violates or may violate the selected rule-map subgraph.
- Memory update is needed but the user did not explicitly request it.

When a Stop condition applies, return only the concrete blocker and the smallest missing input. Do not return a completed Learning Handoff with an unresolved Stop condition embedded in it.
