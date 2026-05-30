---
title: Ship / Learn Goal Template
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
  - pull-request
  - delivery
  - learning
when_to_read:
  - 実装差分をPR化して出荷判断可能な状態にするとき
  - 検証結果、残リスク、学習候補を整理するとき
---

# Ship / Learn Goal

```md
# Ship / Learn Goal

## Goal

実装差分を出荷判断できる状態に整え、次回以降のAI実行単位に渡すべき学習を抽出する。

## Inputs

- 実装ブランチ:
- Requirements / PRD:
- Design Doc:
- 検証結果:
- 関連Issue:

## Scope

- 対象ブランチ:
- PR作成先:
- PRに含める差分:
- PRに含めない差分:
- 更新してよいドキュメント:
- 更新しない領域:

## Autonomy

- AIは差分を確認してよい
- AIはPR本文を作成してよい
- AIは関連Issue、PRD、Design Doc、検証結果をPR本文に反映してよい
- AIは未解決の仕様判断を完了扱いしてはいけない
- AIは恒久化すべき知見の候補を挙げてよい
- AIはユーザーから明示されていないmemory更新を行ってはいけない

## Done

- [ ] PR本文に関連PRDがある
- [ ] PR本文に関連Design Docがある
- [ ] 変更内容が要約されている
- [ ] 受け入れ条件との対応が説明されている
- [ ] 検証結果が書かれている
- [ ] 未確認事項・残リスクが書かれている
- [ ] 無関係な差分が含まれていない
- [ ] 恒久ナレッジ化するもの / しないものが整理されている
- [ ] 次のGoal候補が必要に応じて整理されている

## Verification

- 必ず実行:
  - `git status --short`
  - `git diff --stat`
- 必要なら実行:
  - PR作成前に指定されたアプリ検証コマンド
  - Markdown lintやドキュメント生成コマンド

## Knowledge Update

- 恒久化する判断:
- 更新するドキュメント / skill:
- memory更新の明示依頼:
- 更新しない判断:
- 理由:

## Stop

- 未解決の仕様判断が残っている
- 検証が未完了
- 差分にスコープ外変更が混じっている
- PR作成先、対象ブランチ、関連Issueが曖昧
- 恒久ナレッジにするか判断が必要
- memory更新が必要だがユーザーの明示依頼がない
```
