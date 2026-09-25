---
name: guardrail-improvement
description: Apply manually approved Audit proposals within the existing AIDD Task.
---

# Guardrail improvement

Apply [AIDD v4](../../../docs/ai-driven-development/workflow.md) and
[Audit policy](../../../docs/harness/policies/learning-extraction.md).
Read the current Task and exact Audit proposals. Require a user approval source bound to
these proposals and finite targets before any implementation. An Audit request or original
development authority does not satisfy this boundary. Do not create a separate Task.
Record the approval and a new decision revision using [Core operations](../../../docs/ai-driven-development/aidd-checker-operations.md).
Change only approved targets and check the improvement scope. Re-read the current Intent and
improved guardrails, then record `return-intent` to close this cycle and enter the next cycle
within the same Task. Record a new decision for the next cycle, perform necessary design and
implementation, verify and review the actual diff, Ship, and conduct Audit. The cycle boundary
does not expand approval scope. Proposal changes require renewed approval.
