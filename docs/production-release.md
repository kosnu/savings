---
title: GitHub Releasesによる本番リリース
doc_type: runbook
status: accepted
area: infrastructure
applies_to:
  - .github/workflows/draft_production_release.yaml
  - .github/workflows/release_production.yaml
  - .github/workflows/deploy_production.yaml
  - tools/production-release
topics:
  - release
  - deployment
when_to_read:
  - 本番Releaseを準備・公開するとき
---

# GitHub Releasesによる本番リリース

対象変更が main に取り込まれていることを前提とする。
main 更新で Draft が自動生成され、正式公開すると **DB migration → Web** の順に配信される。
DB が失敗・中断した場合、Web は配信されない。

## 手順

1. **Draft を確認する。** Actions の [Draft Production Release](../.github/workflows/draft_production_release.yaml) の完了後、Releases で Draft を開く。
   タグ・完全な SHA・変更一覧・対象 CI の成功を確認し、[採番基準](production-release-internals.md#バージョンを上げる基準)でバージョン候補を判断する。
   補正が必要なら [Draft の手動補正](production-release-internals.md#draft-の自動準備と手動補正)を行う。
   本番への影響・migration・復旧方法を [Release ノート](production-release-internals.md#release-ノート)に記載する。
2. **公開する。** プレリリース指定を外し、GitHub UI の **Publish release** またはユーザー認証による同等の操作を実行する。
3. **結果と動作を確認する。** Release の **Production deployment** から対象 SHA の run を開き、DB/Web 両方の `success` を確認する。
   [反映後の確認手順](cloudflare-delivery.md#必要なときに参照する詳細)の「Web だけの本番配信と切り戻し」に従い、
   表示・直接アクセス・既存 session・Google ログイン・通常 CRUD・Sentry の受信と map 解決を確認する。

公開は一件ずつ行い、前の配信と動作確認が終わってから次を公開する。文書・保守だけなら公開は必須ではない。

## 必要なときに参照する文書

- [初回の準備](production-release-initial.md)
- [障害時の再実行と復旧](production-release-recovery.md)
- [採番・Draft 操作・内部仕様](production-release-internals.md)
- [開発者向け検証](production-release-development.md)
