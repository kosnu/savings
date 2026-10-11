---
title: AI Driven Development overview
doc_type: overview
status: accepted
area: repository
applies_to:
  - tools/aidd
  - docs/ai-driven-development
topics:
  - ai-driven-development
  - development-principles
when_to_read:
  - AI駆動開発の考え方と文書の責務を確認するとき
---

# AI Driven Development overview

AI駆動開発では、求める成果・制約・完了条件と実行権限を根拠に、設計・実装・検証・レビューを行う。
要求の根拠、採用した設計と理由、実際の検証結果を対応付け、成果が目的を満たすか判断する。
工程名、専用成果物、特定のモデルやツールの使用自体を成功条件にしない。

ドメインやUIの方針は、何を守り、何を判断・確認する必要があるかを所有する。
実行の順序、記録形式、配信・改善の権限境界は、以下の運用文書が所有する。
共通・アプリ方針へ運用手順を複製せず、具体的な操作が必要なときにその正本を参照する。

## 現行の運用文書

- [Workflow](workflow.md): 成果、権限、サイクル、継続と停止。
- [Core](aidd-checker.md)と[操作](aidd-checker-operations.md): Goによるその場の差分・検証・stage・配信先の検査。
- [Audit policy](../harness/policies/learning-extraction.md): Ship後の指摘分析と手動承認の境界。
- [Retrospective](../harness/policies/retrospective.md): Merge / Close後の作業過程の振り返り。通常サイクル外の明示依頼で行う。
- [調査と採否](research-v4.md)、[ADR 0009](../adr/0009-rebuild-aidd-v4.md): 選択の根拠。
- [要求の伝達](issue-guidelines.md)、[用語](glossary.md)、[Codex](codex-adapter.md): 入力とhost連携。

## 過去の仕様と作業履歴

[ADR 0003](../adr/0003-adopt-aidd-invariant-protocol.md)・[0004](../adr/0004-separate-task-scope-from-work-kind.md)・[0005](../adr/0005-compact-aidd-records.md)・[0006](../adr/0006-separate-intent-from-issue.md)・[0007](../adr/0007-align-learn-agent-delegation.md)・[0008](../adr/0008-define-aidd-cycle-boundary.md)は過去の判断を保存する。
[旧compact protocol](compact-protocol.md)は廃止された記録方式の案内であり、現行の実行条件ではない。

`workspaces/`、`migrations/`、`.aidd/tasks/`、`.aidd/v4/`は当時の要求・設計・移行・検証の作業履歴として保持する。
いずれも現在の実行入力や必須成果物の根拠にはせず、現行の契約は上記の正本文書から確認する。
