---
name: retrospective
description: Analyze development-process improvements on explicit Retrospective requests after Merge / Close, outside the normal development cycle.
---

# Retrospective

Apply [Retrospective policy](../../../docs/harness/policies/retrospective.md).
Confirm the requested PR or Issue has been merged or closed and identify the associated Task.
Use available Issue/PR history, decision and verification/review summaries, and conversation context to analyze how the work proceeded. Do not require or generate operation histories, snapshots, or saved command stdout/stderr.
Report evidence, impact, causes or uncertainty, concrete proposals, finite targets, and validation.
Preserve resolved findings and historical records. Do not apply proposals or reopen the normal cycle.
Before presenting the result, apply [analysis-result review](../../../docs/harness/policies/audit.md#分析結果のレビュー), address findings, and re-review affected conclusions. Include the three review conclusions and resolution status; never report unresolved evidence or decisions as cleared.
Finish with the reviewed analysis result, including why no improvement is needed when applicable.
Hand explicitly approved proposals to a new Intent and Task under
[エージェント中心の開発](../../../docs/ai-driven-development/workflow.md); do not reuse the closed Task's Audit approval.
