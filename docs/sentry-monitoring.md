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

Sentry はエラーの分類と配信 JS の位置を調べるために使う。
認証情報、個人情報、支払い明細は送信しない。設定の正本は
[SDK 初期化](../apps/web/src/lib/sentry.ts)と[送信前処理](../apps/web/src/lib/sentryPrivacy.ts)。
実設定と受信の調査結果、未確認事項は [Issue #1888](https://github.com/kosnu/savings/issues/1888) と対応 PR に残す。

## 送信する情報

- 既存の認証 callback・session 取得・月次予算作成の固定エラー文、feature、許可したエラーコード。
  未知のコードは `unknown` とし、サーバーの自由文を送らない。
- 自動捕捉した例外は標準 JS の例外型、同一 origin の `/assets/*.js` の位置、行・列番号を残す。
  エラー本文、関数名、変数、ソース断片、外部 URL は除く。未知の例外型は `Error` とする。
- HTTP breadcrumb は method・status・時刻のみを最大20件保持する。
  URL、query、fragment、headers、body、console、画面操作の breadcrumb は送らない。
- SDK が付与する event ID、時刻、environment、release、dist、SDK メタデータと
  配信 JS の Debug ID を維持する。アプリから user・extra・自由 context・tags・fingerprint を追加しても送信前に除く。

許可した診断情報からイベントを再構成するため、未知の機微語の正規表現検出に依存しない。
SDK が生成する識別子とビルド済み asset 名は診断情報として扱う。
例外本文や breadcrumb の内容を使った調査はできず、未知のコードは細分類できない。
外部 script の例外やソース位置を持たない例外は同じ分類へまとまる場合がある。

## 環境、成果物、使用量

配信用ビルド（Vite の `import.meta.env.PROD`）と非空 DSN が揃った場合だけ初期化する。
モード名は初期化可否ではなく、`VITE_SENTRY_ENVIRONMENT` 未指定時の environment の既定値に使う。
通常の local 開発サーバーは DSN を設定しても送信しない。
本番 workflow の environment は `production`、Dev Preview は `development` に分ける。
Preview の DSN は `development` Environment のSecret `VITE_SENTRY_DSN` からビルドへ渡す。
Secret が未登録・空なら配信を止め、監視が有効な Preview と誤認させない。
Preview CI は `.invalid` ドメインの合成 DSN で同じビルド経路だけを検証し、実 Sentry へ送信しない。
Dev の送信にも既存の情報制限を適用する。DSN の登録・発行と配信・合成イベント送信は、
対象 project・送信内容・通知先・使用量への影響を確認したうえで行う。

[Vite 連携](../apps/web/vite.config.ts)は管理 token・org・project がある本番ビルドでのみ
hidden source map を作り、アップロード後に配信 assets 内の JS/CSS map を削除する。
管理 token は `VITE_` 変数にしない。Debug ID と配信した JS の位置を保ち、
アップロードした同じ成果物を配信する。release の実値、Debug ID の対応とサーバーの解決結果は
ビルド成功だけでは確認できない。

エラーの `sampleRate` は1を維持する。実使用量を確認せずサンプリング率を下げたり、
`ignoreErrors` で障害を除外したりしない。SDK の既存重複排除は維持する。
Session Replay・Tracing・Profiling・Logs の収集拡張は有効化しない。
サーバーの quota・rate limit、ブラウザの offline・広告遮断で受信が欠落しうる。
SDK 送信は業務操作の完了条件にせず、監視 API の同期失敗を認証・予算のエラー処理へ伝播させない。

## 公開前の確認

以下を同一 project・対象 commit と結び付けて確認する。実利用者の情報を試験に使わない。

1. 読み取り権限で project のデータ除去、既定 PII、environment、release、使用量、quota、rate limit、
   現行プランと保存期間、アラート、管理者・MFA、アップロード token の scope と有効期限を確認する。
   秘密値を記録せず、現行値と採用する変更・変更不要の理由を比較する。
2. 合成データで認証、予算失敗、未処理例外を発生させ、ブラウザの送信 envelope と
   Sentry で受信した event を照合する。source map で行・列とソース位置を解決し、
   本番・検証環境と配信 commit を対応付ける。
3. 配信成果物に `.map` と管理 token がないことを確認する。
   アップロード失敗時・削除失敗時の配信可否も確認する。
4. 承認された通知先で主要障害のアラート受信を確認する。通知先・保存期間・有料化・token 再発行は別途承認する。
   重複、サンプリング、quotaによって何が欠落するかを記録する。
5. 変更前後を同じブラウザ、CPU/network 条件、cache 条件、合成データ、操作回数で比較する。
   SDK を含む JS の転送量、初回表示、ログイン・支払い・予算操作の時間、long task、
   Sentry envelope 件数・転送量を各条件複数回測り、中央値と範囲を記録する。
   offline・送信失敗・上限到達時に業務操作が継続するかも確認する。

SDK のローカル検証は `pnpm run web:test:unit-integration` で実行する。
実 SDK とテスト transport による除去・例外位置の保持は、サーバーでの受信・通知・解決の代替にはしない。

## 変更と切り戻し

本番設定とデプロイは、対象 project・commit、変更する項目の前後値、影響、切り戻し方法への承認後に行う。
反映後は実設定を読み戻し、合成イベントの受信と通知を再確認する。
SDK の切り戻しは直前の検証済み成果物を再配信する。ただし自由文を再送信する旧成果物への戻しは
機微情報の除去を弱めるため、その影響を示して承認を得る。
サーバー設定は変更前に確認した値へ対象項目だけを戻し、設定・受信を再確認する。
実値を未確認のまま切り戻し値を推測しない。
