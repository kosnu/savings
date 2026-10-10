---
name: audit
description: Analyze post-Ship findings on explicit Audit requests without applying changes.
---

# Audit

Start only when the user explicitly requests Audit after Ship.
Apply [AIDD v4](../../../docs/ai-driven-development/workflow.md) and
[Audit policy](../../../docs/harness/policies/learning-extraction.md).
Retrieve the current Intent, authority, decision and verification/review summaries, and delivery references from the existing Issue, PR, and conversation.
Analyze the findings and their causes. Preserve resolved status.
Development-process retrospection belongs to [Retrospective](../../../docs/harness/policies/retrospective.md)
after Merge / Close; do not search for process improvements during Audit.
Present evidence, causes or uncertainty, concrete proposals, finite targets, and validation.
Do not apply proposals during Audit. Development or Ship authority is not improvement approval.
Include the change/improvement decision and, for each target PR comment/thread, the reason,
evidence, proposed reply, Bot resolution conditions, and remaining work, following Audit policy.
Report the analysis as a concise summary and update only the current cycle audit result under the Core record contract. Do not persist operation events, snapshots, Ship records, or command stdout/stderr; do not create a record-only commit. Any proposed improvement or comment handling awaits manual approval and is not yet completed. An Audit request alone never authorizes replies or resolution.
Approval of the presented handling authorizes those replies and completed Bot thread resolution
without another execution request. Carry out only the approved targets and actions under Audit
policy and Git Workflow, preserving explicit limits and unresolved work. No-change handling
requires no Task/approval event, empty commit, or improvement cycle; report read-back results. The audit result is analysis, not the next cycle Intent, execution instruction, or approval.
