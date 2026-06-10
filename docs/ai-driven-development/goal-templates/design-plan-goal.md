---
title: Design / Plan Goal Template
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
  - design-doc
  - planning
  - temporal-data
when_to_read:
  - Requirements / PRDをもとにDesign Docを作成するとき
  - 実装方針、影響範囲、テスト方針を整理するとき
---

# Design / Plan Goal

```md
# Design / Plan Goal

## Goal

最新のRequirements / PRDをもとに、実装方針・影響範囲・テスト方針を明確にする。

## Inputs

- Requirements / PRD:
- 関連コード:
- 関連ドキュメント:
  - docs/harness/rule-map.json で選択したサブグラフ:
- 既存テスト:

## Harness Context

- Rule map: `docs/harness/rule-map.json`
- 作業分類:
  - path:
  - domain:
  - activity:
  - topic:
- 選択された関連ドキュメント:
  - path:
    - 選択理由:
- depends_onで追加された前提ドキュメント:

## Scope

- 対象ディレクトリ:
- 変更候補:
- 対象外:

## Domain Value UI Decisions

UIに表示、入力、比較、集計、状態化するドメイン値がある場合、Requirements / PRDの利用目的に沿って、Design Docで次を決める。

- 対象のドメイン値:
- 利用目的:
  - 実値を知りたい
  - 比較したい
  - 残量や到達可否を知りたい
  - 制約に違反していないか知りたい
  - 内訳を確認したい
  - 対象を識別したい
- UIで主に見せるもの:
  - 値そのもの
  - 判断結果
  - 状態
  - 内訳
  - 識別情報
- 比較元、基準値、許可範囲、分類、期間を表示するか:
- loading / empty / error / 未設定 / 0 / 不明 / 削除済みの扱い:
- rule-mapで選択されたWeb UIルール上の文字階層、一覧、余白、button variant、フォーム、overlay、responsiveとの対応:

## Autonomy

- AIは既存実装を調査してよい
- AIは複数案を比較してよい
- AIは推奨案を提示してよい
- AIはStop条件に当たらない限り、Build / Verify Goalへ進むための入力を整理してよい
- AIはこのGoal内では実装してはいけない

## Done

- [ ] 変更対象ファイル・モジュールが整理されている
- [ ] 採用する実装方針が説明されている
- [ ] 採用しない案と理由がある
- [ ] 関連するドメインルールとの整合性が確認されている
- [ ] `docs/harness/rule-map.json` で選択した関連ドキュメントとの整合性が確認されている
- [ ] UIにドメイン値が出る場合、値ごとの利用目的と主表示が決まっている
- [ ] 複数データ更新がある場合、トランザクション単位と操作境界が整理されている
- [ ] 有効期間、履歴、月次状態、削除が関わる場合、過去状態の暗黙復活を避ける設計になっている
- [ ] ユーザーに表示される主要文言がDesign Docで決まっている
- [ ] 既存挙動への影響が整理されている
- [ ] テスト方針がPRDの受け入れ条件と対応している
- [ ] リスクと確認事項が残っている

## Verification

- 必ず実行:
  - なし
- 必要なら実行:
  - 既存テストや型定義の調査コマンド
- 手動確認:
  - 必要に応じて監督者がリスク、逸脱、Stop条件を確認する

## Stop

- 実装方針がプロダクト判断を含む
- PRDの受け入れ条件が曖昧
- 既存のドメインルールと矛盾する
- 影響範囲が想定より広い
- DB / API / 認証 / 権限変更が必要
- トランザクション単位を決めるための仕様判断が不足している
- 現在有効な状態と過去時点の表示を分けるための仕様判断が不足している
- ユーザーに表示される主要文言を決めるための情報が不足している
- `docs/harness/rule-map.json` で選ぶべき関連ドキュメントが曖昧
```
