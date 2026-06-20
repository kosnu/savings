---
title: Ship Goal Template
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
  - review
when_to_read:
  - Build / Verify済みの実装差分をPR化するとき
  - 検証結果、残リスク、レビュー返信を提出用に整理するとき
---

# Ship Goal

```md
# Ship Goal

## Goal

Build / Verify済みの実装差分を、PR、説明、レビュー返信ができる状態に整える。

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
- AIは対応済みレビューコメントへ返信してよい
- AIは完全に完了したreview threadだけをresolveしてよい
- AIは要件充足や仕様判断をShipで作り直してはいけない
- AIはlearn skillに渡すべき知見をShip内で初期Input化してはいけない
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
- [ ] PR本文、変更要約、レビュー返信、thread resolve判断が、選択したルール・ポリシーに違反していないことを確認している

## Verification

- 必ず実行:
  - `git status --short`
  - `git diff --stat`
- 必要なら実行:
  - `gh pr view <PR番号> --json number,title,body,baseRefName,headRefName,url,state,isDraft`
  - `gh api graphql` によるreview thread状態確認
  - PR作成前に指定されたアプリ検証コマンド
  - Markdown lintやドキュメント生成コマンド

## Stop

- 未解決の仕様判断が残っている
- 検証が未完了
- 差分にスコープ外変更が混じっている
- PR作成先、対象ブランチ、関連Issueが曖昧
- レビューコメントの対応が現在の差分やcommitに明確に紐づかない
- review threadをresolveすると未解決の追従作業や確認事項を隠すおそれがある
- Learnで扱うべき知見をShip内で初期Input化する必要がある
- Ship成果物やレビュー返信が選択したルール・ポリシーに違反している、または違反の可能性がある
```
