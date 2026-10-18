---
title: Sentry のエラー監視と運用
doc_type: overview
status: accepted
area: infrastructure
applies_to:
  - apps/web/src/lib/sentry.ts
  - apps/web/src/lib/sentryPrivacy.ts
  - apps/web/vite.config.ts
topics:
  - sentry
  - privacy
  - monitoring
when_to_read:
  - Sentry の収集範囲や障害調査を変更するとき
  - Sentry の受信・source map・使用量・通知を確認するとき
---

# Sentry のエラー監視と運用

Sentry は、障害を分類し、配信したコミットと JavaScript の発生位置を調べるために使う。
認証情報、個人情報、支払い明細を収集せず、業務操作の継続を優先する。

## 監視の方針

送信する診断情報を許可集合に限定し、エラーやサーバー応答の自由文をそのまま送らない。
未知の機微語を正規表現で探して削る方式に依存せず、障害分類とソース位置に必要な情報からイベントを構成する。
この制限により、自由文や操作履歴を使った調査はできず、未知のエラーや外部 script の障害を細かく区別できない場合がある。

監視の送信失敗を、ログイン・支払い登録・予算操作の失敗へ伝播させない。
通信遮断や Sentry 側の制限で受信が欠落しうるため、イベントがないことだけで障害がないと判断しない。
収集対象の追加やイベントの間引きを行う際は、調査に必要な情報、プライバシー、負荷、使用量、検知漏れへの影響から判断する。

## 障害の調査

対象の environment・release・event ID から、障害が起きた環境と配信コミットを特定する。
release はビルドしたコミットを表し、同じコミットを複数環境へ配信した場合は environment で区別する。
JavaScript の位置は、その配信成果物と同じ Debug ID を持つ source map で調べる。
アップロード成功だけでは受信や位置解決の成功を保証しないため、必要なときは受信イベントとの対応を確認する。

同じ project を使う環境では設定・通知・使用量枠も共有される。
environment はイベントを分類する値であり、設定や通知の影響範囲を分離する境界として扱わない。

## 変更と切り戻し

外部設定の変更や配信・試験送信は、対象、通知と使用量への影響、停止条件、復旧方法を明らかにして承認を得る。
確認には合成データを使い、秘密値や実利用者の情報を送信しない。
作業ごとの対象・条件・検証結果・未確認事項は Issue・PR に残す。

source map と管理用認証情報は公開成果物に含めない。
SDK を切り戻す場合は検証済みの成果物を使い、機微情報の除去を弱める旧版への復旧はその影響も判断する。
外部設定は確認済みの変更前の値へ対象項目だけを戻す。復旧値を推測しない。
設定や配信を戻しても、既に受信したイベントや送信済みの通知は取り消せない。

## 実装と配信の参照

- [SDK 初期化](../apps/web/src/lib/sentry.ts)と[送信前処理](../apps/web/src/lib/sentryPrivacy.ts)：送信条件・診断情報の具体的な許可集合。
- [Vite 連携](../apps/web/vite.config.ts)：release の設定と source map の生成・アップロード・削除。
- [Dev プレビュー運用](development-preview.md)：配信経路と Secret の登録。
