---
name: guardrail-improvement
description: Execute manually approved Audit improvements or PR comment replies and completed Bot thread resolution within the existing AIDD Task.
---

# Guardrail improvement

For approved Audit comment handling that requires no improvement, follow Audit policy and
Git Workflow to reply with reasons and evidence and resolve completed Bot threads, without
another execution request. Preserve approved targets and explicit limits, keep unfinished
threads unresolved, and report read-back results. Do not create changes, Task records, empty
commits, or an improvement cycle solely for this handling. The improvement steps below apply
only when an actual improvement proposal is approved.

Apply [AIDD v4](../../../docs/ai-driven-development/workflow.md) and
[Audit policy](../../../docs/harness/policies/learning-extraction.md).
Read the existing Issue, PR, conversation summaries, and exact Audit proposals. Require a user approval source bound to
these proposals and finite targets before any implementation. An Audit request or original
development authority does not satisfy this boundary. Do not create a separate Task.
Confirm approval against the original user source and summarize the adopted decision only as needed in the existing Issue, PR, or conversation. Do not create approval/decision event files or persist command stdout/stderr.
Change only approved targets and check the improvement scope. Re-read the current Intent and
improved guardrails to close this cycle and enter the next cycle within the same Task, without an event or cycle ID. Adopt the next decision, perform necessary design and
implementation, verify and review the actual diff, and Ship. Start the next Audit only on an
explicit user request after Ship. The cycle boundary
does not expand approval scope. Proposal changes require renewed approval.
Complete any approved PR comment handling after verification and Ship, following Audit policy
and Git Workflow; improvement approval does not authorize unpresented replies or resolution.
