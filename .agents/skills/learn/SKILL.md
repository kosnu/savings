---
name: learn
description: Analyze eligible feedback and apply explicitly authorized repository guardrail improvements. Continue authorized improvements in the current Task.
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

For an authorized update, record feedback, authorization and finite ownership in the
current Task. Do not split Tasks or Goals because work changes between product and
guardrail maintenance. Learn requires eligible feedback in the existing Intent-led
Task. Do not start a standalone Learn Task or Goal. If there is no eligible finding,
do not run Learn.

Investigate causes before selecting a countermeasure. Update the owning policy, domain
doc, rule-map, checker, verification or adapter instead of adding redundant instructions.
Task kind does not restrict product or guardrail paths; the actual authorization and
recorded ownership do. Before task-start, use the documented aidd-prepare command to obtain the verified cached
checker. Retain that exact path and the pinned old policy/profile; do not re-prepare
from changed source during Learn. Prepare candidate binaries separately, then review the
latest diff and evidence yourself and finalize within the user's authorized scope.
Independent review is not required. Candidate checker success alone is insufficient. Record the actual reviewer,
observations and authorization; do not invent them.
Apply the cost-benefit conditions in AGENTS.md; routine checks stay in the main agent.

Finish within the requested outcome. Continue already authorized implementation in
the same Task; an analysis or guardrail-only request does not add product authority.
