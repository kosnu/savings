---
title: Dev プレビュー運用
doc_type: overview
status: accepted
area: infrastructure
applies_to:
  - tools/dev-preview
  - .github/workflows/deploy_dev_database.yaml
  - apps/web/cloudflare.config.ts
  - .github/workflows/deploy_preview.yaml
  - .github/workflows/dev_preview_ci.yaml
topics:
  - deployment
  - cloudflare
  - supabase
  - migration
when_to_read:
  - Cloud または PR から Dev プレビューを配信するとき
  - 共有 Dev DB の初期化、migration、復旧を行うとき
---

# Dev プレビュー運用

PRごとに `burneto-dev` のPreviewを配信し、1つのDev SupabaseでDB・Auth・APIを共有する。
本番Worker・本番Supabaseには接続・変更せず、合成データだけを使う。
構成は[インフラ構成](infrastructure.md)、検証結果と未確認項目はIssue・PRで管理する。

## フロントエンドを配信する

1. 同じリポジトリからmain宛てのopen PRを用意し、変更をpushする。merge conflictは先に解消する。
2. PRに `preview` ラベルを付ける。
3. `Deploy Dev Preview` の `development` 承認画面で、表示されたSHAのコード・workflow・依存install script・公開内容を確認して承認する。
4. 対象PRのCI／Checksに表示される `Dev Preview URL / PR #<番号>` のDetailsからPreviewを開く。
   表示された配信結果の確認時刻 (UTC)・PR番号・branch・`run <実行番号>.<試行番号>`で配信を識別する。

`Dev Preview URL / PR #<番号>` は承認済みのPR head SHAへ、配信成功後だけ登録するcommit status。
同じSHAを使う複数PRでも、PR番号ごとに別のstatusでURLを識別する。
mainからの手動実行でも対象PRに表示される。同じSHAの再配信では最新の成功結果へ更新し、
配信失敗・キャンセルは前の成功URLを上書きしない。head更新後は、新しいSHAの配信が成功するまで
そのSHAにURLは登録されない。過去の配信結果はPRの該当commitまたは成功runのSummaryで確認できる。
長いbranch名はstatusの文字数上限で省略される場合がある。
Summaryにはクリック可能な全URL、完全なPR・branch・commit・deployment ID・確認時刻・run/attemptへのリンクを残す。
URL通知のPRコメントは投稿しない。

配信成功後に `Publish Dev Preview URL` だけが失敗した場合、Summaryで配信結果を確認し、
そのjobだけを再実行してstatusを登録する。既に新しい成功配信が登録されていれば古い結果は登録しない。
URL表示の修復のために配信jobを再実行する必要はない。

同じPRは `pr-<PR番号>` の同じURLへ更新され、別PRは同じブランチでも別URLになる。
branch renameでも対象名は変わらない。導入前のbranch名方式のURLは次の配信時に切り替わる。
pushだけでは再配信されない。更新時は `preview` ラベルを外して付け直す。
main導入後はmainからworkflowを手動実行し、PR番号だけを入力する方法も使える。
CloudもこのActions経路を使うため、Cloudへの配信用Secret登録は不要。

Actionsは要求時のSHA・branchを固定し、承認後もPR状態を再確認する。
head更新・branch rename・close・ラベル撤回で停止したら、新しい状態で要求し直す。
fork、main以外へのPR、main以外からの手動実行は受け付けない。
同一PRの配信・終了通知・削除は直列化し、実行中の配信は中断しない。別PRは並行配信できる。
置き換えられた配信待ち要求は再要求する。古い要求でもPRが終了済みなら配信せず削除へ進む。

FE配信ではmigration・seed・reset・Auth設定を変更しない。
`Dev Preview CI` は実Dev URLとダミーキーでビルド・成果物を検査する。
URLは公開の接続先識別子であり、このCIは実DB接続や認証の成功を検証しない。

## 設定とAPIのCI検証

確認対象と満たすべき状態は[Supabase設定変更のDev確認手順](supabase-dev-verification.md)を参照する。
`Supabase verification`はPRの隔離DB/API試験と、mainから手動実行するDevの読み取り照合を持つ。
Go実装の入力・実行条件・必要権限は[検証コードの案内](../tools/supabase-check/README.md)を参照する。
Dev照合はdevelopment Environmentの承認を使い、DB適用と同じgroupで直列化する。
設定変更・権限追加・migration適用は行わない。既存DB適用tokenに不足する読み取り権限は自動追加しない。

## 共有Dev DBを更新する

DB変更は全Previewに影響する。SQL全文、新旧FEとの互換性、検証の停止範囲、
データ損失と復旧方法を確認する。破壊操作は具体的な承認が必要。

1. PRに `dev-db` ラベルを付ける。main導入後は `Deploy Dev Database` にPR番号を指定して手動実行もできる。
2. `development` 承認画面の固定SHAと未適用migrationを確認して、1回承認する。
3. jobはPRとDev refを再確認し、Supabase CLIでlink → dry-run → 適用を行う。
   dry-run後に追加の承認待ちはないため、承認前にSQL全文を確認する。
4. 成功後、headを変えず `preview` を要求する。FE承認画面のSHAがDB runと一致することを確認する。

全branchのDB jobは `burneto-shared-dev-database` で承認待ちを含め直列化し、実行中はcancelしない。
SQL Editor・MCP・Cloud等の外部書き込みはlock対象外なので、CI実行・承認待ち中には行わない。
workflowは `db push --linked --skip-vault --dry-run` の後に `--yes` で適用する。
seed・reset・roles・Vault更新、`--include-all`、履歴repair、自動rollbackは実行しない。
DB成功だけでFEは配信されない。

### migrationの互換性

- 適用済みSQLは編集・削除しない。同versionのSQL改変やschema driftはこのCIでは検知しない。
- 別branchの適用済みmigrationが不足して停止したら、そのファイルを取り込み、未適用migrationを後のversionに調整して新しいheadで要求し直す。
- schema追加 → 新旧FEの検証 → 古いPreviewの終了 → 不要なschema削除、の順で進める。
- 途中で失敗したら自動retryせず、履歴とログで適用済みの範囲を確認し、追加migrationによる修正をレビューする。

## 初期設定

管理者が対象と影響を確認し、承認後に一度設定する。
有料化、新しい永続token・grant、OAuth・公開範囲・ネットワーク設定の変更は事前確認が必要。

### Devプロジェクトと認証

- projectは `Burneto Dev`、refは `ufekmuxkmodwydxmdbln`。本番ref `izuzqvgvgquqqimwuygw` は使わず、本番dump・ユーザー・バックアップをコピーしない。
- 初期migrationはDB workflowで適用する。[Data APIのdefault grants](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)に注意し、認証済みユーザーでtable・RPCを確認する。不足権限は最小grantとRLSをレビューしてDevだけへ適用する。
- Google providerはDev専用OAuth clientで設定する。callbackは `https://ufekmuxkmodwydxmdbln.supabase.co/auth/v1/callback`。DB workflowからhosted Authの `config push` は行わない。
- Site URLは代表Previewのoriginにし、redirect allow listへ各Previewの正確な `https://<preview>-burneto-dev.<subdomain>.workers.dev/auth` を登録する。登録数が増えた場合だけaccount・Workerに限定したwildcardを承認して使う。`https://*.workers.dev/**` は使わない。

### CloudflareとGitHub Environment

専用Worker `burneto-dev` とworkers.devで配信する。parentは初回Preview配信時に作成できる。
workers.devは公開URLであり、認証機能ではない。private source・非公開文面・実データを含む場合は、
公開範囲またはAccess保護の承認を確認してから配信する。

`development` Environmentに以下を登録する。本番と同じSecret名で、値はDev専用にする。
productionからのコピー・repository Secretでの代用はしない。値をチャット・ログ・履歴へ貼らない。

| Secret                          | 用途                                              |
| ------------------------------- | ------------------------------------------------- |
| `VITE_SUPABASE_URL`             | `https://ufekmuxkmodwydxmdbln.supabase.co`        |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Devの公開クライアント用キー                       |
| `VITE_SENTRY_DSN`               | Dev Sentry project のエラー送信用 DSN             |
| `VITE_SENTRY_ENVIRONMENT`       | `development`                                     |
| `SENTRY_AUTH_TOKEN`             | Dev Sentry project の source map アップロード認証 |
| `SENTRY_ORG`                    | Dev Sentry の組織 slug                            |
| `SENTRY_PROJECT`                | DSN と同じ Dev Sentry project の slug             |
| `CLOUDFLARE_ACCOUNT_ID`         | 配信先account                                     |
| `CLOUDFLARE_API_TOKEN`          | Dev配信用token                                    |
| `SUPABASE_PROJECT_ID`           | `ufekmuxkmodwydxmdbln`                            |
| `SUPABASE_ACCESS_TOKEN`         | Dev project限定のscoped PAT                       |

required reviewerは所有者 `kosnu`、Prevent self-reviewと管理者bypassは無効とする。
branch policyはmainとPR merge refを許可する。FEとDBは同じEnvironmentを使うため、
承認者はworkflowのSecret参照も確認する。必要なSecretだけを各stepへ渡し、DB管理tokenはFEへ渡さない。
service_role・secret key・DB passwordはブラウザへ渡さない。
Sentry の5項目は本番と同じ Secret 参照でビルドへ渡す。環境名の固定値や Variables は使わない。
`VITE_SENTRY_ENVIRONMENT` は `development` に登録する。production の Secret は自動継承されない。
5項目のいずれかが未登録・空ならビルド前に停止する。
本番と同じ Vite プラグインで hidden source map を生成・アップロードし、アップロード後に配信 assets から JS/CSS map を削除する。
管理 token はビルドだけに渡し、`VITE_` 変数やブラウザへ公開しない。
通常の local 開発サーバーは Sentry を初期化しない。
収集範囲と受信確認は [Sentry の運用](sentry-monitoring.md)を参照する。
Secret の登録・発行やイベント送信は、対象・通知先・使用量への影響を確認してから行う。

Cloudflare tokenは可能な最小権限にする。account全Workerへの権限しか選べない場合は本番にも届く範囲を明示して承認を得る。
Supabase PATは本番も対象になるclassic/Legacy PATを転用せず、対象project・権限・有効期限を所有者が確認する。
固定CLIに必要な権限はProject Settings・API Keys・API Key Secrets・Connection PoolingのReadと、
一時login role発行のためのDatabase Read-write。
Network Bans、Network Restrictions、Auth設定、project変更・削除、billing権限は追加しない。
DB password・host・CA PEMは登録せず、接続はCLIに任せる。debugログやキーを転載しない。

### バージョンと利用上限

`cf 1.0.0-beta.1`、Cloudflare Vite plugin `2.0.0-beta.sha-c82c3efb3`、Supabase CLI `2.118.0` を使う。
依存更新時はhelp・Preview context・Build Output・返却JSONを再検証する。
cfは `previews deploy <name> --prebuilt --mode development` を使い、JSONを抑止する `--quiet` は指定しない。

無料枠の空きと利用中planは設定時・変更時に管理画面と公式情報で確認する。
[Workers Previews](https://developers.cloudflare.com/workers/previews/)の上限到達時には自動削除があるため、保持保証のあるアーカイブには使わない。
[Static Assets](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)、
[Workers limits](https://developers.cloudflare.com/workers/platform/limits/)、
[Supabase pricing](https://supabase.com/pricing)、
[GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)も確認する。
public repositoryでは標準GitHub-hosted runnerを使い、private化・plan変更時はEnvironment保護の利用条件も再評価する。

## 失敗時・復旧・削除

### 配信や認証が失敗したとき

runのログ・Summary・実deployment履歴を確認する。build成功だけで実配信・DB接続の成功としない。
通信失敗でも配信済みの可能性があるため、履歴を確認してから再実行を判断する。
認証失敗ではDevのGoogle provider、callback、redirect allow list、table・RPCの権限とRLSを確認する。
エラーを理由に権限を自動拡張しない。

### 合成データとreset

初回データはDev専用ユーザーでログインし、UIでカテゴリ・少数の支払い・予算を作る。
検証者ごとのアカウントとBookを使い、既存 `bin/init_seed` は接続先・所有モデルを確認せず実行しない。
FE再配信ではseedを繰り返さない。

通常の初期化はUIで対象の合成データを決めて行う。
全体resetは全Previewのデータ・Auth session・検証結果に影響するため自動化しない。
停止対象、失うデータ、保持するユーザー、migration履歴、Devバックアップと再作成fixtureを示して承認を得る。
Free planの自動バックアップ・PITRは前提にせず、本番バックアップは使わない。

### フロントエンドの切り戻しとDB復旧

FEを以前のcommitへ戻してもDB・Auth・データは戻らない。
非互換なら該当Previewを停止し、追加migrationで互換性を回復して新旧FEの読み書きを確認する。
承認されたreset・復旧が必要な場合はDevを指す隔離した作業場所でCLI helpを確認して実施する。
復旧後はDev ref、migration履歴、Auth設定、grants・RLSを照合し、
再ログイン・fixture再作成・新旧FEの読み書きを確認して利用を再開する。

### Previewを削除するとき

PRのclose・mergeで `Deploy Dev Preview` の `Delete closed PR Dev Preview` が自動で要求される。
既存の `development` Environment のrequired reviewを維持するため、所有者が削除jobを承認する。
承認待ち・失敗は削除完了ではない。ActionsのSummaryでPR番号・親Worker `burneto-dev`・
Preview名・削除成功／不在／保護／失敗を確認する。不在は正常終了し、認証・通信・APIエラーは失敗する。
失敗時は原因を確認し、同じrunを再実行できる。PRをreopen済みなら削除せず、再配信を要求できる。

配信と終了通知は同じPRのconcurrency groupで直列化する。closeが配信・承認待ち中に到着しても、
配信終了後の状態確認から削除する。置き換わった待ちrunや終了後の古い配信runの再実行も、
現在のclosed状態を確認して配信せず削除へ進む。配信途中の失敗でも状態確認を行う。
open PRの正常配信では削除承認を要求せず、既存のChecks URL登録を維持する。
導入前の旧workflowで開始した配信はこの後処理を持たないため、導入時に完了・停止を確認する。
runの手動キャンセルや削除承認の拒否、API障害では残存し得るため、対象の終了runを再実行して確認する。

受付・状態確認・削除は `pull_request_target` / mainの手動実行時の信頼済みmainコードを使う。
削除jobは独立runnerで実行し、PRコード・依存install script・配信jobの成果物を実行しない。
削除対象は `pr-<PR番号>` と、移行前のbranch名方式で得た対応Previewだけ。
[Preview専用API](https://developers.cloudflare.com/api/resources/workers/subresources/workers/subresources/previews/methods/delete/)を使い、
Workerの削除や `force` は行わない。本番Worker・Dev parent・共有Supabase・Auth redirect・データは変更しない。
同じbranchを使う別のopen PRがある場合は、移行前の共有Previewを保護して削除しない。
PR番号方式のPreviewは別PRと共有しないため、同じbranchでも対象PRのPreviewだけを削除する。
最後のPRが終了した時に削除する。ラベル・配信履歴のないPRでも対象名の不在を正常に扱う。
既存残存Previewの一括削除は行わない。導入前にbranch renameして残ったPreviewや検証終了だけを理由とする削除は、
管理者が対象名・最終deployment・切り戻しの要否を確認し、別途承認を得てDashboardで行う。
Auth redirectの削除が必要なら、そのPreviewのentryだけを対象として別途承認する。
Preview削除でDBデータは消えないため、データ初期化は所有者と別に調整する。

## 実機検証

ビルドやfixtureテストでは画面・認証・DB操作の確認を代用できない。結果と未確認事項はIssue・PRに記録する。

- 別ブランチの異なるURLで画面を開き、同じブランチの更新が同じURLに反映され、別Previewが維持されること。
- 両PreviewがDev refへ通信し、Googleログイン後に `/payments` へ遷移すること。
- 同じテストユーザーの合成データ更新を別Previewでも確認できること。
- `/payments` の直接アクセスと、別アカウントのBookが見えないこと。
- 旧FEへ切り戻した後も共有schemaで読み書きできること。
- bundle・設定・通信先がDevだけを指すこと。本番データへアクセスして確認しない。
