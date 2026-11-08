---
title: 本番リリース機構の開発者向け検証
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
  - verification
when_to_read:
  - リリース機構のコードやworkflowを変更・検証するとき
---

# 本番リリース機構の開発者向け検証

リリース機構のコードや workflow を変更したときの検証手順。
通常の本番リリースでは、[通常のリリース手順](production-release.md)を使う。

## 検証コマンド

API fixture と workflow の接続を、本番に接続せず検査する。
リポジトリルートで実行する。

```sh
node --test tools/production-release/*.test.mjs tools/dev-preview/*.test.mjs
actionlint .github/workflows/release_production.yaml .github/workflows/deploy_production.yaml .github/workflows/draft_production_release.yaml .github/workflows/production_release_ci.yaml
```

起動条件・配信対象・自動検証の仕様は[内部仕様](production-release-internals.md)を参照する。
