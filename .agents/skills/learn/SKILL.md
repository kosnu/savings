---
name: learn
description: Convert review comments, verification findings, operational findings, changed rules, or policy updates into the next Requirements input for the AI Driven Development workflow. Use when the user asks to learn from feedback, prepare the next loop input, classify review findings for the next Requirements Goal, or says 学習, 次回Input, or レビューを次に反映. This skill does not set or execute a Codex Goal.
---

# Learn

## Purpose

Prepare the input for the next Intent / Requirements Goal.

Use this skill for Build / Verify-completed artifact feedback, PR review comments about the implementation result, verification findings that should change the next input, operational findings, and rule or policy updates.

Do not set a Goal. Do not execute implementation work. Do not write target product artifacts unless the user separately asks for that. The output is a compact handoff that can be passed to `$goal-setting requirements`.

## Inputs

Use only these sources:

- Original Issue or initial input.
- Review comments.
- Verification findings.
- Operational findings.
- Changed rules or policies.
- Explicit oversight constraints from the user.

Build / Verify-internal test failures, type errors, lint failures, implementation consistency fixes, and call-site adjustments are not automatically next Requirements input. Include them only when they reveal a changed requirement, rule, policy, oversight constraint, or durable verification expectation.

Do not use these as source of truth for the next Requirements or Design:

- Previous implementation code.
- Previous UI behavior.
- Current diff shape.
- Previous implementation-specific design choices.
- Assumptions derived from how the previous implementation happened to work.

Do not inspect implementation files while using this skill.

## Required Repository Context

Read the smallest useful set:

- `docs/ai-driven-development/workflow.md`
- `docs/harness/policies/review-feedback-classification.md`
- `docs/harness/rule-map.json`
- Any rule, policy, domain, ADR, or app-specific docs selected from `docs/harness/rule-map.json`

Use GitHub PR or issue data only when needed to read the referenced feedback or initial input.

## Rule / Policy Compliance Check

Before returning the handoff, check that the next Requirements input, rule / policy references, oversight constraints, exclusions, and Stop Checks do not violate the selected `docs/harness/rule-map.json` subgraph or this skill's input restrictions.

If the handoff would rely on previous implementation code, previous UI behavior, current diff shape, previous implementation-specific design choices, or assumptions from the previous implementation, do not return it as complete. Treat it as a Stop condition.

## Classification

Classify each finding by what it changes for the next Requirements input:

- Initial input: the original Issue, goal, scope, success criteria, or oversight constraints need revision.
- Rule / policy: a repository rule, policy, or durable guidance needs update or explicit reference.
- Requirements constraint: the next Requirements must include this as a constraint or acceptance criterion.
- Exclude: the finding should not enter the next Requirements input.

Classification is not used to choose a later restart phase. The next cycle starts from Intent / Requirements.

## Output Shape

Return only a concise Markdown handoff:

```md
# Next Requirements Input

## Source

- Original input:
- Feedback source:
- Rule / policy source:

## Include

- Initial input changes:
- Rule / policy references or updates:
- Oversight constraints:
- Requirements constraints:

## Exclude

- Item:
- Reason:

## Stop Checks

- Missing input:
- Ambiguity:
- Rule / policy update needed:
```

Omit empty sections only when they would add no information. Keep the handoff compact enough to paste into `$goal-setting requirements`.

## Stop

Stop before producing a handoff when:

- The feedback source is ambiguous.
- The original Issue or initial input is missing and cannot be inferred.
- A rule or policy update is required but the target document is ambiguous.
- The next input cannot be explained without relying on previous implementation code, previous UI behavior, current diff shape, or previous implementation-specific design choices.
- The handoff violates or may violate selected rules, policies, or this skill's input restrictions.
- Memory update is needed but the user did not explicitly request it.
