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
- `beforeSend` を通らない session envelope は送らない。既定の `BrowserSession` integration を除外し、自動 session 収集を停止する。
- 破棄理由・件数・時刻を含む `client_report` も送らない。`sendClientReports: false` により破棄 outcome の収集・送信を停止する。

許可した診断情報からイベントを再構成するため、未知の機微語の正規表現検出に依存しない。
SDK が生成する識別子とビルド済み asset 名は診断情報として扱う。
例外本文や breadcrumb の内容を使った調査はできず、未知のコードは細分類できない。
外部 script の例外やソース位置を持たない例外は同じ分類へまとまる場合がある。

## 環境、成果物、使用量

配信用ビルド（Vite の `import.meta.env.PROD`）と非空 DSN が揃った場合だけ初期化する。
モード名は初期化可否ではなく、`VITE_SENTRY_ENVIRONMENT` 未指定時の environment の既定値に使う。
通常の local 開発サーバーは DSN を設定しても送信しない。
本番・Dev Preview とも、各 GitHub Environment の5つの Secret を同じ方法でビルドへ渡す。
`VITE_SENTRY_DSN` は対象 project の送信先、`VITE_SENTRY_ENVIRONMENT` は本番で `production`、Dev で `development` にする。
Sentry は org `kosnu` の project `savings` を共用し、environment で本番と Dev を区別する。
Dev の受信確認では `environment:development` と対象 release・event ID を照合する。
environment は検索・分類のための区分であり、それだけで project の設定・通知・使用量上限が分離されるわけではない。
`SENTRY_AUTH_TOKEN` はアップロード用認証、`SENTRY_ORG`・`SENTRY_PROJECT` はその送信先を指す。
5項目のいずれかが未登録・空なら、両配信 workflow ともビルド前に停止する。
production の Secret は development に継承されない。Dev 専用値を各 Environment に登録し、追加の Variables は使わない。
Preview CI は `.invalid` ドメインの合成 DSN で同じビルド経路だけを検証し、実 Sentry へ送信しない。
Dev の送信にも既存の情報制限を適用する。DSN の登録・発行と配信・合成イベント送信は、
対象 project・送信内容・通知先・使用量への影響を確認したうえで行う。

[Vite 連携](../apps/web/vite.config.ts)は管理 token・org・project がある配信用ビルド（`command === "build"`）で
モード名に依存せず hidden source map を作り、アップロード後に配信 assets 内の JS/CSS map を削除する。
プラグイン自身のエラー・性能 telemetry は `telemetry: false` で停止する。
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

### Dev Preview での実検証

Issue #1888 の検証対象は Dev・隔離環境に限定する。Prd の試験・実設定照合・変更・デプロイは含めない。
検証用 PR を作成しただけでは Preview は配信されない。
[Dev Preview の配信手順](development-preview.md)に従い、配信対象の PR・head SHA と development の承認を対応付ける。

配信・設定変更・合成イベント送信の前に、次の内容を Issue・PR または会話で具体化し、承認を得る。

- **対象**：PR・head SHA、Sentry の org/project と `development`、配信先の Preview URL。
  配信前には対象 PR と予定する Preview 名を示し、配信後に実 URL を読み戻して送信対象を確定する。
- **受信許可**：Sentry の Allowed Domains に対象 Preview の origin が含まれるかを確認する。
  追加が必要な場合は、そのホストだけを追加する案と前後値を示す。本番の許可を残し、全ドメインを許可する `*` へ広げない。
  共通 project の設定変更であることも承認対象に含める。
- **送信内容・上限**：合成の認証情報・メールアドレス・支払いメモを使う試験内容と、再試行を含めた最大送信件数を示す。
  初回の例は認証失敗・予算作成失敗・未処理例外を各1件、合計3件まで。追加送信が必要なら上限と影響を見直す。
  実利用者の情報や秘密値は使わない。
- **通知先・使用量**：対象イベントに適用されるアラートの environment 条件、通知条件・間隔、実際の受信者を確認する。
  既存通知を使う場合も試験通知の発生を承認対象に含める。新しい外部通知先や有料化は別途承認する。
  Dev の送信も共通 project・organization の使用量枠を消費するため、試験前の残量を確認する。
- **停止・復旧**：承認した上限、対象・環境の不一致、機微情報の残存を検知したら送信を止める。
  一時追加した受信許可は検証後に追加分だけを戻す。送信停止や設定の復元で、受信済みイベント・送信済み通知は取り消せない。

承認後は「公開前の確認」の送受信・ソース位置・公開成果物・通知を、同じ Preview の成果物に結び付けて確認する。
Secrets の登録名、アップロード token の名前・最終利用、ビルド成功だけでは、値の妥当性や実受信を確認済みにしない。
IP アドレスの保存防止など共通の収集設定も採用方針と照合し、未確認・不一致を environment の分離だけで解消済みにしない。
結果は PR に確認対象・成否・必要な event ID 等の参照と未確認事項を短く残し、秘密値や機微情報を含む生の envelope・画面は転載しない。

性能比較と送信失敗・offline・上限到達時の操作は、合成データを使い、Sentry への実送信を遮断した隔離環境で確認する。
上限到達は Sentry の実際の使用量枠を消費して再現せず、送信先の失敗・429 応答を隔離環境で再現する。
これは実 Sentry の受信・通知確認とは区別し、変更前後の比較条件・対象差分と測定結果を示す。

## 変更と切り戻し

本番設定とデプロイは、対象 project・commit、変更する項目の前後値、影響、切り戻し方法への承認後に行う。
反映後は実設定を読み戻し、合成イベントの受信と通知を再確認する。
SDK の切り戻しは直前の検証済み成果物を再配信する。ただし自由文を再送信する旧成果物への戻しは
機微情報の除去を弱めるため、その影響を示して承認を得る。
サーバー設定は変更前に確認した値へ対象項目だけを戻し、設定・受信を再確認する。
実値を未確認のまま切り戻し値を推測しない。
