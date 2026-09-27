---
name: audit
description: Analyze post-Ship findings and session process improvements without applying changes.
---

# Audit

Start only when the user explicitly requests Audit after Ship.
Apply [AIDD v4](../../../docs/ai-driven-development/workflow.md) and
[Audit policy](../../../docs/harness/policies/learning-extraction.md).
Retrieve the existing Task, latest decision, verification, review, and delivery information from the PR.
Analyze both feedback and the session's development process. Preserve resolved status.
Present evidence, causes or uncertainty, concrete proposals, finite targets, and validation.
Do not apply proposals during Audit. Development or Ship authority is not improvement approval.
If no improvement is needed, report the reason and finish without a Task record.
Otherwise report awaiting explicit manual approval; commit the Audit record with the approved improvement.
