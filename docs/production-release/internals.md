---
title: 本番リリースの採番と内部仕様
doc_type: overview
status: accepted
area: infrastructure
applies_to:
  - .github/workflows/draft_production_release.yaml
  - .github/workflows/release_production.yaml
  - .github/workflows/deploy_production.yaml
  - tools/production-release
topics:
  - release
  - versioning
  - deployment
when_to_read:
  - バージョンを判断または手動指定するとき
  - Draftや配信workflowの動作を確認するとき
---

# 本番リリースの採番と内部仕様

[通常のリリース手順](index.md)から参照する採番基準、Draft の操作方法、配信の内部仕様。

## バージョンを上げる基準

DB/Web 共通の `vMAJOR.MINOR.PATCH` を使う。
[SemVer](https://semver.org/lang/ja/) を利用者の操作・保存データ・認証・API の互換性に適用する。
前回正式版以降の変更全体で最も大きい影響を一度だけ採用し、PR 数や変更行数では決めない。

| 分類       | `1.x` 以降 | `0.x` の間                       |
| ---------- | ---------- | -------------------------------- |
| 修正・保守 | PATCH      | PATCH                            |
| 機能追加   | MINOR      | MINOR                            |
| 破壊的変更 | MAJOR      | MINOR ＋破壊的変更をノートへ明記 |

- **修正・保守：** 互換性を保つ不具合・性能・セキュリティ修正、依存更新、内部整理。文書・CI のみの公開も含む。
- **機能追加：** 既存操作・API を維持した検索・画面・入力項目・RPC の追加。
- **破壊的変更：** API・入力形式の廃止、保存データの意味の非互換な変更、機能削除、継続利用に必須のデータ・認証移行操作。

migration や見た目の変更だけでは破壊的変更としない。
互換な機能用 schema 追加は機能追加、振る舞いを保つ index 追加は修正・保守に当たる。
不具合修正でも互換性を失えば破壊的変更を優先する。

**`v1.0.0` は自動で付けない。**
`v1.0.0` にする場合は、主要操作・保存データ・認証・API の維持する契約と将来の移行方針を確認する。
安定版として互換性を維持する方針を決めたうえで、明示指定する。

## Draft の自動準備と手動補正

### 自動準備される内容

main 更新時に、未使用の次番号・その時点の完全な SHA・GitHub 生成ノートを Draft へ反映する。
タグ作成・正式公開・配信は行わない。

採番元は公開済み正式版の最大番号とし、Draft・プレリリースは除外する。

### 自動採番の入力

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) の次の指定から候補を出し、担当者が[採番基準](#バージョンを上げる基準)と照合する。

- `feat`：機能追加。
- `fix`、`perf`、`refactor`、`build`、`ci`、`chore`、`docs`、`test`、`style`、`revert`：修正・保守。
- `feat!:` / `fix(scope)!:` のような `!`、本文の `BREAKING CHANGE:` / `BREAKING-CHANGE:`：破壊的変更を優先。

Squash merge は PR title、通常 merge は各 commit と merge 本文先頭の PR title が入力になる。
取り消しの自動相殺はしない。形式不明・前回タグの履歴不包含・一覧やノートの取得失敗は、推測せず停止する。

### 番号を補正する／1.0.0 にする

main から **Draft Production Release** を手動実行し、`version` を指定する。
公開済み正式版がある場合は、その最大番号より大きい番号を指定する。
手動指定では自動推論を使わないため、変更全体を確認する。

### 特定の SHA だけを準備する

Releases で未使用タグと完全な対象 SHA を指定して、手動 Draft を作る。
自動準備の対象は最新 main なので、特定の SHA を指定する場合は使わない。

自動生成用マーカーを付けず、進行中の準備 run・既存 Draft／タグと衝突しないことを確認する。

### 追記と更新の範囲

自動管理されるのは番号・タイトル・SHA と、`production-release-draft:start` / `end` コメント間の内容。
コメントの外側への追記は維持する。

他者の Draft・既存タグとの衝突は上書きせず停止する。古い main の再実行で候補を巻き戻さない。

## Release ノート

[通常のリリース手順](index.md)で本番への影響・migration・復旧方法を追記するときは、
`production-release-draft:start` / `end` コメントの外に記載する。

DB 変更時は[配備互換性の方針](../harness/policies/transaction-boundaries.md#api契約変更と配備互換性)に従う。
DB/Web は一括で元に戻らないため、新 DB と旧 Web の互換性、または必要な停止範囲をノートに記載する。

## 起動と配信対象

[Release Production](../../.github/workflows/release_production.yaml) が `release.published` を受け、
Release ID・公開時 SHA を main の [Deploy Production](../../.github/workflows/deploy_production.yaml) へ渡す。
workflow の `GITHUB_TOKEN` で Release を公開しても後続イベントは起動しない。

Draft 保存・タグ push・PR merge・プレリリース公開は配信しない。
プレリリースから属性を変更するだけの配信を期待せず、新しい正式版を作る。

| 実行するもの                 | 使用する commit      |
| ---------------------------- | -------------------- |
| workflow・配信用の補助コード | 実行時の main        |
| DB/Web・Sentry               | 検証済み Release SHA |

公開・再実行は直列化する。実行中の migration は後続公開で取り消されないが、待機 run は置き換えられ得る。
すべての公開の配信や、受付順の実行（FIFO）は保証しない。

## 自動で検証すること

配信前と各配信 job の開始時に、次を検証する。

- 公開済みの正式版であること。
- タグの実 SHA が公開時の SHA と一致すること。`target_commitish` を実 SHA の代用にしない。
- 対象 commit が main に含まれること。

Release の削除・Draft 化・タグ移動・API 失敗で停止する。
production Environment に reviewer が設定されている場合は、配信時にその承認が必要になる。

## 公式資料

- [Release イベント](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#release)
- [GITHUB_TOKEN と起動制限](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow)
- [再実行](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs)
- [Supabase db push](https://supabase.com/docs/reference/cli/supabase-db-push)
- [Workers rollback](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
