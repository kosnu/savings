---
title: Learn Goal Template
doc_type: template
status: accepted
area: repository
applies_to:
  - docs
  - apps/web
  - apps/api
topics:
  - ai-driven-development
  - codex-goal
  - learning
  - review
  - policy
when_to_read:
  - レビューコメント、検証結果、運用知見を次回Requirementsの入力へ整理するとき
  - ルール・ポリシー変更を次回AI実行単位へ反映するとき
---

# Learn Goal

```md
# Learn Goal

## Goal

レビューコメント、検証結果、運用知見、ルール・ポリシー変更を、次回のIntent / Requirements Goalに渡す初期Inputへ整理する。

## Inputs

- 元のIssue / 初期Input:
- 関連PR:
- レビューコメント:
- 検証結果:
- 変更されたルール / ポリシー:
- 監督者からの追加制約:
- 関連ドキュメント:
  - docs/harness/rule-map.json で選択したサブグラフ:

## Scope

- 次回Requirementsへ渡す入力:
- 更新または参照するルール / ポリシー:
- 次回に含めない項目:
- 変更しない領域:

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- 作業分類:
  - path:
  - domain:
  - activity:
  - topic:
- Selected nodes: `id` -> `file`: reason
- Depends-on nodes: `id` -> `file`: reason
- Conflict decision: none / overrides / priority

## Autonomy

- AIはレビューコメント、検証結果、ルール、ポリシーを読んでよい
- AIは次回Requirementsの初期Input案を作成してよい
- AIは恒久化すべき知見の候補を挙げてよい
- AIは前回実装コード、前回UI挙動、現在diff形状を次回入力の根拠にしてはいけない
- AIはユーザーから明示されていないmemory更新を行ってはいけない

## Done

- [ ] 次回のIntent / Requirements Goalに渡す初期Inputが整理されている
- [ ] レビューコメントや検証結果が、初期Input、ルール、ポリシー、監督制約のどれに反映されるか整理されている
- [ ] 次回に含めない項目と理由が整理されている
- [ ] 前回実装コード、前回UI挙動、現在diff形状を根拠にしていない
- [ ] 次回サイクルはIntent / Requirementsから始める前提になっている
- [ ] 恒久ナレッジ化するもの / しないものが整理されている

## Verification

- 必ず実行:
  - なし
- 必要なら実行:
  - Markdown lintやドキュメント生成コマンド

## Knowledge Update

- 恒久化する判断:
- 更新するドキュメント / skill:
- memory更新の明示依頼:
- 更新しない判断:
- 理由:

## Stop

- 次回Requirementsへ渡すべき入力が分類できない
- ルール・ポリシー更新が必要だが、更新対象が曖昧
- 前回実装を根拠にしないと入力を説明できない
- memory更新が必要だがユーザーの明示依頼がない
```
