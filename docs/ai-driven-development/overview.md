---
title: AIDD v4 overview
doc_type: overview
status: accepted
area: repository
applies_to:
  - tools/aidd
  - docs/ai-driven-development
topics:
  - ai-driven-development
  - aidd-v4
when_to_read:
  - AIDD v4 overviewを判断または変更するとき
---

# AIDD v4 overview

AIDD v4はIntentを受け、設計・実装・検証・レビュー・Shipを行い、Auditと承認された改善につなぐ。

- [Workflow](workflow.md): 成果、権限、サイクル、継続と停止。
- [Core](aidd-checker.md)と[操作](aidd-checker-operations.md): Goによる証拠・状態の検査。
- [Audit policy](../harness/policies/learning-extraction.md): 振り返りと手動承認の境界。
- [調査と採否](research-v4.md)、[ADR 0009](../adr/0009-rebuild-aidd-v4.md): 選択の根拠。
- [Intent](issue-guidelines.md)、[用語](glossary.md)、[Codex](codex-adapter.md): 入力とhost連携。

旧版のworkspaces、migrations、`.aidd/tasks/`と[ADR 0003](../adr/0003-adopt-aidd-invariant-protocol.md)・[0004](../adr/0004-separate-task-scope-from-work-kind.md)・[0005](../adr/0005-compact-aidd-records.md)・[0006](../adr/0006-separate-intent-from-issue.md)・[0007](../adr/0007-align-learn-agent-delegation.md)・[0008](../adr/0008-define-aidd-cycle-boundary.md)は履歴であり、v4の実行入力ではない。現在の契約は上記のWorkflow、Core、用語集、Codex adapterが所有する。
