---
title: GitHub Releasesによる本番リリース
doc_type: runbook
status: accepted
area: infrastructure
applies_to:
  - .github/workflows/release_production.yaml
  - .github/workflows/deploy_production.yaml
  - tools/production-release
topics:
  - release
  - deployment
  - supabase
  - cloudflare
  - recovery
when_to_read:
  - 本番Releaseを準備・公開するとき
  - 本番配信の結果確認・再実行・復旧を行うとき
---

# GitHub Releasesによる本番リリース

正式な Release のタグが指す **同じ commit** から、DB migration → Web の順に本番へ反映する。
DB が失敗・中断したら Web は配信しない。自動化は Draft の準備までで、正式公開が本番配信の開始要求になる。

## 通常のリリース手順

1. **main に取り込む。** 対象の CI・レビューを完了し、GitHub 上の main にリリース機構と対象変更があることを確認する。
   初回の配信対象は、この仕組みを含む commit 以降を選ぶ。
2. **Draft を確認する。** main 更新後の [Draft Production Release](../.github/workflows/draft_production_release.yaml) が完了したら、
   Releases で番号・完全な SHA・変更一覧を確認する。[採番基準](#バージョンを上げる基準)と照合し、影響・migration・復旧方法を
   `production-release-draft:start` / `end` コメントの**外**へ追記する。文書・保守だけなら公開は必須ではない。
3. **対象への公開承認を確認する。** Release ID・タグ・SHA・変更内容・本番への影響・復旧方法を提示する。
   この対象への有効な承認は引き継ぐ。Draft 準備や番号の承認だけを公開承認に読み替えず、候補が変われば変更部分を再確認する。
   DB 変更時は[配備互換性の方針](harness/policies/transaction-boundaries.md#api契約変更と配備互換性)と、
   適用済み／未適用 migration、実在するバックアップ・復元範囲・許容損失を確認する。
   DB/Web は一括で元に戻らないため、新 DB と旧 Web の互換性、または必要な停止範囲を承認対象に含める。
4. **正式公開する。** 準備 run の完了、承認対象と Draft の一致、対象の必要な CI の成功を再確認し、
   GitHub UI の **Publish release** またはユーザー認証による同等の操作を実行する。
   プレリリース指定は外す。workflow の `GITHUB_TOKEN` で公開しても後続イベントは起動しない。
5. **反映を確認する。** Release の **Production deployment** から対象 SHA の配信 run を開き、DB/Web 両方の `success` を確認する。
   続いて migration 履歴・Worker の active version と対象 SHA を対応付け、
   [反映後の確認手順](cloudflare-delivery.md#必要なときに参照する詳細)の「Web だけの本番配信と切り戻し」に従って、
   表示・直接アクセス・既存 session・Google ログイン・通常 CRUD・Sentry の受信と map 解決を確認する。
   配信成功と実機確認を分けて報告し、未確認は明示する。記録先は Issue コメントや PR とし、Issue 本文へ作業ログを追記しない。

公開・再実行は一件ずつ行い、前の配信と確認が終わるまで次を公開しない。
実行中の migration は後続公開で取り消されないが、待機 run は置き換えられ得るため、全公開の配信や FIFO は保証しない。
結果欄がない・古い場合は Actions の受付／配信 run・各 job・attempt・summary を調べる。過去の成功表示を今回の成功に使わない。

**初回のみ：** 旧方式の Deploy Production が実行中・待機中でないことと、実際の反映状態を確認する。
旧 run は新しい直列化の対象外なので、重複配信が起きない状態で開始する。

## バージョンを上げる基準

DB/Web 共通の `vMAJOR.MINOR.PATCH` を使う。[SemVer](https://semver.org/lang/ja/) を利用者の操作・保存データ・認証・API の互換性に適用し、
前回正式版以降の変更全体で最も大きい影響を一度だけ採用する。PR 数や変更行数では決めない。

| 分類       | 判断の例                                                                                            | `1.x` 以降 | `0.x` の間                       |
| ---------- | --------------------------------------------------------------------------------------------------- | ---------- | -------------------------------- |
| 修正・保守 | 互換性を保つ不具合・性能・セキュリティ修正、依存更新、内部整理。文書・CI のみの公開も含む           | PATCH      | PATCH                            |
| 機能追加   | 既存操作・API を維持した検索・画面・入力項目・RPC の追加                                            | MINOR      | MINOR                            |
| 破壊的変更 | API・入力形式の廃止、保存データの意味の非互換な変更、機能削除、継続利用に必須のデータ・認証移行操作 | MAJOR      | MINOR ＋破壊的変更をノートへ明記 |

migration や見た目の変更だけでは破壊的変更としない。互換な機能用 schema 追加は機能追加、振る舞いを保つ index 追加は修正・保守。
不具合修正でも互換性を失えば破壊的変更を優先する。`0.x` でもデータ損失や無断の機能削除を許可しない。

初回は **`v0.1.0`**。**`v1.0.0` は自動で付けない。** 主要操作・保存データ・認証・API の維持する契約と
将来の移行方針を確認し、安定版として互換性を維持する承認を得て明示指定する。

## Draft の自動準備と手動補正

main 更新時に、未使用の次番号・その時点の完全な SHA・GitHub 生成ノートを Draft へ反映する。
タグ作成・正式公開・配信は行わない。新しい公開用 token やラベルは不要。
採番元は公開済み正式版の最大番号で、Draft・プレリリースは除外する。

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) の次の指定から候補を出し、担当者が上の互換性基準と照合する。

- `feat`：機能追加。
- `fix`、`perf`、`refactor`、`build`、`ci`、`chore`、`docs`、`test`、`style`、`revert`：修正・保守。
- `feat!:` / `fix(scope)!:` のような `!`、本文の `BREAKING CHANGE:` / `BREAKING-CHANGE:`：破壊的変更を優先。

Squash merge は PR title、通常 merge は各 commit と merge 本文先頭の PR title が入力になる。説明は既存規約に従い日本語で書く。
取り消しの自動相殺はしない。形式不明・前回タグの履歴不包含・一覧やノートの取得失敗は、推測せず停止する。
初回は過去全履歴の type に関係なく `v0.1.0` とする。

- **番号を補正する／1.0.0 にする：** main から Draft Production Release を手動実行し、`version` を指定する。
  公開済み最大番号より大きく、初回は `v0.1.0` 以上とする。手動指定では自動推論を使わないため、変更全体を確認する。
- **特定の SHA だけを準備する：** 最新 main を対象にする自動準備は使わず、Releases で未使用タグと完全な対象 SHA を指定して手動 Draft を作る。
  main の先端へ読み替えない。自動生成用マーカーを付けず、進行中の準備 run・既存 Draft／タグと衝突しないことを確認する。
- **追記と更新：** 自動管理は番号・タイトル・SHA と上記コメント間。外側の追記は維持する。
  他者の Draft・既存タグとの衝突は上書きせず停止し、古い main の再実行で候補を巻き戻さない。

## 失敗時の再実行と復旧

まず Release・SHA・成功済みの範囲・実反映を確認し、当初の承認が有効な範囲で対処する。
通信エラーで成否不明なら、実状態を調べてから判断し、公開や配信を重ねて起動しない。
新しい版の配信後に古い run を再実行して戻さない。対象や復旧方法が変われば、その変更への承認を得る。

| 状態                     | 対応                                                                                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 公開受付・事前検証に失敗 | タグ・SHA を確認。不正な対象はタグを付け替えず、修正した新 Release を準備する。一時的な API 障害なら同じ受付を再実行できる                                           |
| DB 失敗                  | Web は未配信。migration 履歴・ログから部分適用とデータへの影響を調べ、安全に再適用できる場合だけ再実行する                                                           |
| DB 成功、Web 失敗        | Worker の active version を確認。新 DB と旧 Web の互換性を維持して同じ Release を再実行する                                                                          |
| Web 配信後の障害         | [Web 切り戻し](cloudflare-delivery.md#必要なときに参照する詳細)で確認済みの旧 Worker version へ戻す。新 DB と互換な場合に限り、DB・Auth・データは戻らない            |
| DB 復旧が必要            | 自動 down migration は行わず、原則は修正 migration を含む新 Release で前進復旧。データ復元は実在するバックアップ・復元時点・停止／損失範囲を確認し、別途承認して行う |
| 結果欄だけ更新失敗       | DB/Web の job と実反映を確認し、report job のみ再実行する。DB/Web の再配信は不要                                                                                     |

通常は Deploy Production の **Re-run all jobs** を使う。適用済み migration は履歴でスキップするが、
複数 migration 全体の rollback、失敗 SQL の副作用解消やデータ復元は保証しない。
失敗 job だけの再実行も Release を再検証する。Web のみの再実行は同じ Release の DB 成功が確認できる場合に限る。

再実行可能期間の経過・workflow 修正後は、Deploy Production を `main` から手動実行し、
Release API で確認した ID を `release_id` に、タグの commit・元 run で確認した完全な SHA を `expected_sha` に指定する。
公開済み正式版の再配信専用で、任意の ref は指定できない。Release の削除・Draft 化・タグ移動は本番の取り消しや DB 復元にならない。

## 配信の仕組みと検証

[Release Production](../.github/workflows/release_production.yaml) が `release.published` を受け、
Release ID・公開時 SHA を main の [Deploy Production](../.github/workflows/deploy_production.yaml) へ渡す。
Draft 保存・タグ push・PR merge・プレリリース公開は配信しない。プレリリースから属性を変更するだけの配信を期待せず、新しい正式版を作る。

配信前と各配信 job の開始時に、公開済み正式版・タグの実 SHA・main への包含を検証する。
`target_commitish` を実 SHA の代用にせず、削除・Draft 化・タグ移動・API 失敗で停止する。
workflow と補助コードは実行時の main、DB/Web と Sentry は検証済み Release SHA を使う。
既存の production Environment・Secret と Dev 運用は維持する。Environment に reviewer がある場合の承認と、公開前承認は別である。

以下は本番接続なしの API fixture・workflow 接続検査であり、実イベント配送・承認・配信の成功は別途確認する。
リポジトリルートで実行する。

```sh
node --test tools/production-release/*.test.mjs tools/dev-preview/*.test.mjs
actionlint .github/workflows/release_production.yaml .github/workflows/deploy_production.yaml .github/workflows/draft_production_release.yaml .github/workflows/production_release_ci.yaml
```

公式資料：[Release イベント](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#release)、
[GITHUB_TOKEN と起動制限](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow)、
[再実行](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs)、
[Supabase db push](https://supabase.com/docs/reference/cli/supabase-db-push)、
[Workers rollback](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)。
