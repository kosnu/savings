---
name: learn
description: Analyze eligible feedback and apply explicitly authorized repository guardrail improvements. Learn does not implement product behavior.
---

# Learn adapter

For feedback analysis, read [Learning Extraction](../../../docs/harness/policies/learning-extraction.md).
For review feedback, apply [Review Feedback Classification](../../../docs/harness/policies/review-feedback-classification.md).
For authorized updates, apply [workflow](../../../docs/ai-driven-development/workflow.md)
and use [operations](../../../docs/ai-driven-development/aidd-checker-operations.md)
when preparing the checker or running task commands. Read applicable rule-map documents
and their required dependencies; these routes do not reduce mandatory review coverage.

An extraction request authorizes analysis only. Apply guardrail changes only within
explicitly authorized scope. Do not create an Issue for Learn.

For an authorized update, create an independent Learn Task from feedback, authorization
and finite guardrail ownership. Use an independent Goal if requested; never reuse or
complete an unfinished Development Goal merely to start Learn.

Investigate causes before selecting a countermeasure. Update the owning policy, domain
doc, rule-map, checker, verification or adapter instead of adding redundant instructions.
The Learn contract permits guardrail implementation and its tests, but rejects product
paths. Before task-start, use the documented aidd-prepare command to obtain the verified cached
checker. Retain that exact path and the pinned old policy/profile; do not re-prepare
from changed source during Learn. Prepare candidate binaries separately, then review the
latest diff and evidence yourself and finalize within the user's authorized scope.
Independent review is not required. Call another agent only when the user explicitly
requests it. Candidate checker success alone is insufficient. Record the actual reviewer,
observations and authorization; do not invent them.
Apply the cost-benefit conditions in AGENTS.md; routine checks stay in the main agent.

Finish at guardrail verification and finalization. If product implementation is needed,
report the existing Development Issue and required outcome as a handoff; do not start it.
