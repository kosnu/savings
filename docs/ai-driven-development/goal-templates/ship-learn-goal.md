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
  - review
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
- 関連PR:
- 対応済みレビューコメント:
- 関連ドキュメント:
  - docs/harness/rule-map.json で選択したサブグラフ:

## Scope

- 対象ブランチ:
- PR作成先:
- PRに含める差分:
- PRに含めない差分:
- 更新してよいドキュメント:
- 更新しない領域:

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

- AIは差分を確認してよい
- AIはPR本文を作成してよい
- AIは関連Issue、PRD、Design Doc、検証結果をPR本文に反映してよい
- AIは `docs/harness/policies/review-feedback-classification.md` に沿って対応済みレビューコメントへ返信してよい
- AIは完全に完了したreview threadだけをresolveしてよい
- AIは未解決の仕様判断を完了扱いしてはいけない
- AIは恒久化すべき知見の候補を挙げてよい
- AIはユーザーから明示されていないmemory更新を行ってはいけない

## Done

- [ ] PR本文に関連PRDがある
- [ ] PR本文に関連Design Docがある
- [ ] PR本文または残リスクに、必要な関連ドキュメントとの接続がある
- [ ] 変更内容が要約されている
- [ ] 受け入れ条件との対応が説明されている
- [ ] 検証結果が書かれている
- [ ] 未確認事項・残リスクが書かれている
- [ ] 無関係な差分が含まれていない
- [ ] 対応済みレビューコメントに分類、対応内容、commit ID、検証結果が具体的に返信されている
- [ ] 完了済みreview threadだけがresolveされている
- [ ] 恒久ナレッジ化するもの / しないものが整理されている
- [ ] 次のGoal候補が必要に応じて整理されている

## Verification

- 必ず実行:
  - `git status --short`
  - `git diff --stat`
- 必要なら実行:
  - `gh pr view <PR番号> --json number,title,body,baseRefName,headRefName,url,state,isDraft`
  - `gh api graphql` によるreview thread状態確認
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
- レビューコメントの対応が現在の差分やcommitに明確に紐づかない
- review threadをresolveすると未解決の追従作業や確認事項を隠すおそれがある
- 恒久ナレッジにするか判断が必要
- memory更新が必要だがユーザーの明示依頼がない
```
