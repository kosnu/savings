---
title: 本番リリースの初回準備
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
  - initial-setup
when_to_read:
  - リリース機構を導入して最初の本番Releaseを準備するとき
---

# 本番リリースの初回準備

1. GitHub 上の main にリリース機構が取り込まれていることを確認する。
   配信対象は、この仕組みを含む commit 以降を選ぶ。
2. 旧方式の Deploy Production が実行中・待機中でないことと、実際の反映状態を確認する。
   旧 run は新しい直列化の対象外なので、重複配信が起きない状態で開始する。
3. 最初のバージョンは、過去全履歴の type に関係なく **`v0.1.0`** になる。
   手動指定する場合は `v0.1.0` 以上を指定する。

準備後は[通常のリリース手順](index.md)に進む。
番号を手動指定する場合は[Draft の手動補正](internals.md#draft-の自動準備と手動補正)を参照する。
