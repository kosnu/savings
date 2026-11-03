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

公開済みの正式な GitHub Release を本番配信の単位にする。
Release のタグが指す commit から Supabase の migration を適用し、成功した場合だけ
同じ commit の Web を Cloudflare Workers Static Assets へ配信する。
Release ノートから変更内容・対象 commit・配信実行と DB/Web の結果を確認できる。
workflow の成功と、反映後の実機確認は分けて扱う。

初回の公開前には、旧方式で起動した Deploy Production が実行中・待機中でないことを確認する。
旧 run は新しい concurrency group に参加しないため、先に完了と反映状態を確認し、
重複配信が起きない状態で新しい方式を開始する。

## 公開前の準備と承認

1. 必要な CI とレビューを終えて main に merge し、対象の完全な commit SHA を確認する。
   最初の Release は、この仕組みを含む commit 以降を選ぶ。
2. バージョンは担当者が変更内容から決め、未使用の `vMAJOR.MINOR.PATCH` タグを使う。
   最初は `v0.1.0` を基本にし、以後は破壊的変更・機能追加・修正に応じて手動で増分を選ぶ。
   自動採番、自動タグ作成、自動公開は行わない。
3. GitHub の Releases で Draft を作成する。新しいタグの対象には承認対象の完全な SHA を指定し、
   既存タグを使う場合も実際の対象 commit を確認する。移動する main の先端を公開対象の代用にしない。
   Generate release notes を使い、前回との差分、migration、互換性、利用者への影響を確認・補足する。
4. DB と Web の配信は全体で atomic にはならない。新 DB と旧 Web が動く期間と、Web 配信失敗時の
   互換性を確認する。破壊的変更では [配備互換性の方針](harness/policies/transaction-boundaries.md#api契約変更と配備互換性)
   を決め、必要な段階的変更または明示された停止範囲を承認対象に含める。
5. Release・対象 SHA・変更内容・本番への影響・復旧方法への承認を得る。
   DB を変更する場合は適用済み migration と未適用分、バックアップの実在・復元範囲・許容損失も確認する。
   未確認のバックアップやプランを復旧保証に使わない。

Draft の保存、タグの push、PR の merge だけでは配信しない。
プレリリースの公開も配信対象外とする。正式 Release として配信する場合は新しい正式版を作り、
対象・内容を再確認して公開する。プレリリースからの属性変更だけで配信されることを期待しない。

## 公開から本番反映まで

承認済み Draft のプレリリース指定を外して **Publish release** を実行する。
公開自体が本番配信の開始要求になるため、承認前には公開しない。
通常は GitHub UI で人が公開する。`GITHUB_TOKEN` による Release 公開はイベントから次の workflow が
起動しないため、この手順の代用にしない。

- [Release Production](../.github/workflows/release_production.yaml) が `release.published` を受け、
  Draft・プレリリースを除外する。Release ID と公開時の SHA を `main` の
  [Deploy Production](../.github/workflows/deploy_production.yaml) に dispatch する。
- Deploy Production は main 上でのみ実行し、公開済み正式版・タグの実 SHA・main への包含を検証する。
  `target_commitish` はタグの実 SHA の代わりにしない。削除・非公開化・タグ移動・API 取得失敗は配信を止める。
- DB/Web は既存の `production` Environment と個別の Secret 参照を維持する。
  Environment のブランチ制約・承認規則を満たした後、各 job が Release を再検証し、
  共通の検証済み SHA を checkout する。配信 workflow と補助コードは実行時の main の SHA を使う。
  タグを Environment の許可対象に追加する必要はない。
- DB の `supabase db push` が失敗・中断した場合、Web は開始しない。
  Web は同じ SHA を `SENTRY_RELEASE` に使い、一度ビルドした成果物を dry-run 後に配信する。
  Dev の workflow、Environment、Secret、プレビュー運用は変更しない。
- DB/Web を含む workflow 全体を直列化し、後続の公開によって実行中の migration を取り消さない。
  待機中の run は後続 run に置き換えられ得る。公開・再実行は一件ずつ行い、
  前の配信と確認が完了するまで次の Release を公開しない。FIFO や全公開の配信は保証しない。

Environment に reviewer が設定されていれば、その承認も必要になる。
Environment 名の参照だけでは人手承認を保証しない。公開前承認と GitHub 側の保護規則は区別し、
この仕組みの導入では既存規則・Secret の移動や変更を行わない。

## 結果の確認

1. Release ノート末尾の **Production deployment** から、対象 SHA と **配信実行** を開く。
   DB と Web がともに `success` の場合だけ配信成功とする。
   再実行するとこの結果欄を更新し、元の変更内容は保持する。過去の attempt は実行画面から確認する。
2. 結果欄がない、または前回結果のままなら、Release Production と Deploy Production の実行状態を確認する。
   受付・事前検証の失敗、待機中の取消、強制中断、Release 編集 API の失敗では結果欄が更新されない場合がある。
   結果欄の欠落や古い成功を今回の成功としない。Actions の各 job・attempt と summary を確認する。
3. 対象 run の SHA と Supabase migration 履歴、Worker の active version を対応付ける。
   表示・直接アクセス・既存 session・Google ログイン・通常 CRUD・Sentry の受信と map 解決を
   [反映後の確認手順](cloudflare-delivery.md#必要なときに参照する詳細)の「Web だけの本番配信と切り戻し」に従って確認する。
   結果・不足は対象 Issue のコメントや PR に要約し、Issue 本文へ作業ログを追記しない。

## 再実行と復旧

再実行も本番への変更要求である。原因・対象 Release・SHA・既に成功した範囲を確認し、
当初の承認が有効な範囲で行う。新しい Release の配信後に古い run を再実行して戻さない。
workflow の不具合修正で対象や復旧方法が変わる場合は、その変更への承認を得る。

| 状態                     | 対応と制限                                                                                                                                                                                   |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 公開受付・事前検証に失敗 | 不正タグや SHA 不一致を確認する。既存タグを付け替えて通さず、内容を修正した新 Release を準備する。API の一時障害なら同じ公開受付を再実行できる。                                             |
| DB 適用に失敗            | Web は未配信。migration 履歴・ログを調べ、部分適用とデータへの影響を確認する。複数 migration 全体の rollback は保証しない。原因を修正し、安全に再適用できる場合だけ再実行する。              |
| DB 成功、Web 失敗        | DB は新しい状態、Web は旧版または配信結果不明になり得る。Worker の active version を確認し、互換性を維持して同じ Release を再実行する。                                                      |
| Web 配信後の障害         | [Web の切り戻し](cloudflare-delivery.md#必要なときに参照する詳細)で、確認済みの旧 Worker version へ戻す。DB・Auth・利用者データは戻らない。旧 Web が新 DB と互換である場合だけ行う。         |
| DB の復旧が必要          | 自動 down migration は行わない。原則は修正用 migration を含む新 Release による前進復旧。データ復元が必要なら、実在するバックアップと復元時点、停止・損失範囲を確認し、別途承認して実施する。 |
| 結果欄の更新だけ失敗     | DB/Web の job と実反映を確認し、配信結果を再確認する。DB/Web を再実行する必要はなく、report job だけを再実行できる。                                                                         |

通常は Deploy Production の **Re-run all jobs** で同じ Release ID・SHA を再検証する。
既に適用済みの migration は履歴によりスキップされるが、失敗した SQL の副作用やデータ復元を
自動解決するものではない。失敗 job だけの再実行でも配信 job は Release を再検証する。
Web だけの再実行は、同じ Release の DB 成功が確認できる場合に限る。

GitHub の再実行可能期間を過ぎた場合や workflow 修正後は、Deploy Production を `main` で起動し、
`release_id` と公開時の完全な `expected_sha` を指定する。これは公開済み正式 Release の再配信専用であり、
任意の branch/ref を配信する入口ではない。Release ID は Release API、SHA はタグの commit と元の run で確認する。
Release の削除・タグの付け替え・Draft 化は、本番からの取り消しや DB 復元にならない。

## 検証

本番 Secret・実 DB・実配信を使わず、次を repository root で実行する。

```sh
node --test tools/production-release/*.test.mjs tools/dev-preview/*.test.mjs
actionlint .github/workflows/release_production.yaml .github/workflows/deploy_production.yaml .github/workflows/production_release_ci.yaml
```

API fixture と workflow の接続検査は、対象 SHA の伝播・拒否条件・結果報告・権限分離を確認する。
実 Actions のイベント配送、Environment 承認、Supabase 適用、Cloudflare 配信の成功は保証しない。
実反映は承認後に行い、上記の結果確認を別に実施する。

## 参照

- [GitHub Release イベント](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#release)
- [workflow からの起動と GITHUB_TOKEN](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow)
- [workflow の再実行](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs)
- [Supabase db push](https://supabase.com/docs/reference/cli/supabase-db-push)
- [Workers rollback](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
