---
title: Intent / Requirements Goal Template
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
  - requirements
  - prd
when_to_read:
  - Requirements / PRD相当の要求整理を作成するとき
  - AIに目的、制約、成功条件を整理させるとき
---

# Intent / Requirements Goal

```md
# Intent / Requirements Goal

## Goal

背景・ありたい姿・既存コード・既存ドキュメントをもとに、実装前にRequirements / PRD相当の要求整理を作成する。

## Oversight Inputs

- なぜ今これをやりたいか:
- どのユーザー体験を改善したいか:
- 成功したと言える状態:
- 守りたい制約:
- まだ決めていないこと:

## Scope

- 対象:
- 関連Issue / チケット:
- 対象ユーザー:
- 対象機能:
- 対象外:

## Autonomy

- AIは既存コード、既存ドキュメント、関連Issueを調査してよい
- AIは曖昧な点を質問してよい
- AIはRequirements / PRDドラフトを作成してよい
- AIは提示された実装案をそのまま前提にせず、目的と制約から整理してよい
- AIはStop条件に当たらない限り、次のDesign / Plan Goalへ進むための入力を整理してよい
- AIはこのGoal内では実装してはいけない

## Done

- [ ] 背景と課題が説明されている
- [ ] 対象ユーザーと利用シーンが明確
- [ ] ユーザーストーリーがある
- [ ] スコープ内 / 外が明確
- [ ] 機能要件が検証可能な形で書かれている
- [ ] UI文言やエラー表示が関わる場合、ユーザーが状態や失敗理由を理解できることが必要か整理されている
- [ ] 非機能要件・制約が必要に応じて書かれている
- [ ] 受け入れ条件がテスト可能
- [ ] Q&Aログに判断と理由が残っている
- [ ] 技術的考慮事項が参考情報として整理されている

## Verification

- 必ず実行:
  - なし
- 手動確認:
  - 必要に応じて監督者が受け入れ条件とStop条件を確認する

## Stop

- 要件の意図が複数解釈できる
- 対象ユーザーや成功条件が不明
- 既存仕様と矛盾する
- スコープ外の変更が必要そう
```
