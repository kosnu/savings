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
  - temporal-data
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
- ユーザーが判断したいこと:
- 守りたい制約:
- まだ決めていないこと:

## Scope

- 対象:
- 関連Issue / チケット:
- 対象ユーザー:
- 対象機能:
- 対象外:

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

## Domain Value Intent

UIに表示、入力、比較、集計、状態化するドメイン値がある場合、`docs/harness/rule-map.json` で選択した domain / Web UI ルールに沿って、値ごとの利用目的をRequirements / PRDに整理する。

- 対象のドメイン値:
- 利用目的:
  - 実値を知りたい
  - 比較したい
  - 残量や到達可否を知りたい
  - 制約に違反していないか知りたい
  - 内訳を確認したい
  - 対象を識別したい
- 値そのものを見せたいのか、判断結果を見せたいのか:
- 比較元、基準値、許可範囲、分類、期間を添える必要があるか:

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
- [ ] UIにドメイン値が出る場合、値ごとの利用目的が整理されている
- [ ] UI文言やエラー表示が関わる場合、ユーザーが状態や失敗理由を理解できることが必要か整理されている
- [ ] 有効期間、履歴、月次状態、削除が関わる場合、`docs/harness/policies/temporal-data.md` に沿って基準日と過去/現在/未来の具体例がある
- [ ] 非機能要件・制約が必要に応じて書かれている
- [ ] 受け入れ条件がテスト可能
- [ ] Q&Aログに判断と理由が残っている
- [ ] 技術的考慮事項が参考情報として整理されている
- [ ] Issue、Oversight Inputs、関連ドキュメントから読み取れる意図・制約・対象外を超えて解釈を広げていない
- [ ] `docs/harness/rule-map.json` で選択した関連ドキュメントとの整合性が確認されている
- [ ] Requirements / PRDが、選択したルール・ポリシーに違反していないことを確認している

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
- Issue、Oversight Inputs、関連ドキュメントから読み取れない要求や成功条件を追加する必要がある
- `docs/harness/rule-map.json` で選ぶべき関連ドキュメントが曖昧
- Requirements / PRDが選択したルール・ポリシーに違反している、または違反の可能性がある
```
