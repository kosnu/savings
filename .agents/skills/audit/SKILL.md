---
name: audit
description: Analyze post-Ship findings on Audit requests or requests to fix review feedback on a shipped PR. Present the handling plan before any authorized fix.
---

# Audit

Start after Ship when the user requests Audit or asks to fix review feedback on the shipped PR.
Apply [エージェント中心の開発](../../../docs/ai-driven-development/workflow.md) and
[Audit policy](../../../docs/harness/policies/audit.md).
Before analysis, resolve the target and retrieve current findings following
[Audit policy](../../../docs/harness/policies/audit.md#audit).
Honor an explicit target. Otherwise retain the current working Task and delivery PR;
a recent edit to another Issue alone does not switch the Audit target.
Retrieve the current Intent, authority, decision and verification/review summaries, and delivery references from the existing Issue, PR, and conversation.
Analyze the findings and their causes. Preserve resolved status.
Development-process retrospection belongs to [Retrospective](../../../docs/harness/policies/retrospective.md)
after Merge / Close; do not search for process improvements during Audit.
Present evidence, causes or uncertainty, concrete proposals, finite targets, and validation.
Before presenting the result, apply [analysis-result review](../../../docs/harness/policies/audit.md#分析結果のレビュー), address findings, and re-review affected conclusions. Include the three review conclusions and resolution status; never report unresolved evidence or decisions as cleared.
Present the reviewed handling plan before ending Audit. For a fix request, continue with the
delegated fix in the same Task after Audit, following the normal verification, review, and Ship workflow.
Use the original request as authority for in-scope work. Guardrail and Intent improvements require manual approval.
Include the change/improvement decision and, for each target PR comment/thread, the reason,
evidence, proposed reply, Bot resolution conditions, and remaining work, following Audit policy.
Report the analysis in the PR or conversation. If this cycle already uses Core phase records, update its audit result. A task without records needs no backfilled design or audit file. Do not persist operation events, snapshots, Ship records, or command stdout/stderr; do not create a record-only commit. End analysis-only requests after presenting the result.
Carry out replies and completed Bot thread resolution after Audit when the original request delegates them or the user approves the presented actions. Follow Audit policy and Git Workflow, preserving explicit limits and unresolved work. No-change handling
requires no Task/approval event, empty commit, or improvement cycle; report read-back results. The audit result is analysis, not the next cycle Intent, execution instruction, or approval.
