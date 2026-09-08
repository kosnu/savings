---
name: learn
description: Investigate eligible feedback and improve reusable repository guardrails through the independent AIDD Learn entrypoint. Use for explicit learning extraction or authorized guardrail updates. Learn does not require an Issue and never implements product behavior.
---

# Learn adapter

Read `docs/harness/policies/learning-extraction.md`,
`review-feedback-classification.md`, `docs/ai-driven-development/workflow.md`,
`aidd-checker-operations.md` and applicable rule-map documents.

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
