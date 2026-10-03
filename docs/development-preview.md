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

`branch → burneto-dev の Preview → 共有 Dev Supabase (Auth / Data API / DB)` とする。
本番 `burneto` / `burneto.com` / 本番 Supabase には接続も設定変更も行わない。
構成の正本は[インフラ構成](infrastructure.md)。DB はブランチごとに分離されないため、
同じテストアカウントの操作・データ変更は他の Preview にも見える。

## 採用機能と費用

2026-10-03 に固定依存の `cf 1.0.0-beta.1`、Cloudflare Vite plugin
`2.0.0-beta.sha-805ec1ff3` の実装・help を確認した。
`cf previews deploy <name> --prebuilt --mode development` が native Previews を配信し、
JSON に `preview_urls` と `deployment_id` を返す。`--quiet` は結果JSONも抑止するため指定しない。plugin は
`CLOUDFLARE_PREVIEW_BUILD=true` により `buildContext.isPreview=true` を生成する。
通常の `cf deploy` や古い Version URL をブランチ Preview の代用にはしない。
依存更新時は help、config context、Build Output、返却 JSON を再検証する。

- [Workers Previews](https://developers.cloudflare.com/workers/previews/): Free は Worker ごとに
  100 Preview、各 Preview 100 deployment。上限到達時は最終配信が最も古い Preview、
  または最古 deployment が自動削除される。保持を保証するアーカイブには使わない。
- [Static Assets](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/):
  静的リクエストは無料・無制限。[Free の上限](https://developers.cloudflare.com/workers/platform/limits/)は
  version あたり20,000ファイル、1ファイル25MiB。サーバー処理や有料 binding は追加しない。
- [Supabase Free](https://supabase.com/pricing): active project は2つ、DB 500MB、egress 5GB、
  50,000 MAU。1週間非稼働で pause する。既存 project 数・organization の plan を管理画面で
  確認してから Dev を1つ作る。Pro organization の追加 project は無料とは限らない。
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions):
  public repository の標準 GitHub-hosted runner を使う。private 化・larger runner 利用時は再評価する。

無料枠の空き、利用中 plan、account 側の対応はローカルビルドから判断できない。
有料化・上限変更・新しい永続 token/grant・OAuth/公開範囲/ネットワーク設定変更・削除/reset は
対象と影響を提示し、実行前に承認を得る。

## 初期設定（管理者が承認後に一度実施）

1. 既存 account の料金と上限を確認する。Dev 専用 Supabase project `Burneto Dev` を1つ選び、
   project ref が本番 `izuzqvgvgquqqimwuygw` と異なることを確認する。本番 dump や user をコピーしない。
2. 下記の専用 DB CI で、検証する PR ブランチの migration 計画を確認・承認して適用する。
   [新規 project の Data API default grants 変更](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)に注意する。
   既存 migration は一部の従来 default grants に依存するため、migration 成功だけで API 利用可能とはしない。
   認証済みテストユーザーで必要な table/RPC を確認し、不足権限は table/column/RPC ごとの最小 grant 案と
   RLS の対応をレビュー・承認してから Dev のみに適用する。包括的 GRANT や本番への修正は行わない。
3. Dev の Google provider を別 OAuth client / テストユーザーで設定する。Google callback は
   `https://<dev-ref>.supabase.co/auth/v1/callback`。本番 client の変更・再生成はしない。
4. 既存 Cloudflare account の workers.dev subdomain を確認し、専用 `burneto-dev` parent の作成と
   公開を承認する。CLI は初回 Preview 配信時に parent を作成できるため本番 deploy は不要。
   token は Dev 配信用途に限定し、Dashboard で可能な最小権限を選ぶ。account 全 Worker への権限しか
   選べない場合は本番にも届く範囲を明示して承認を得る。token 自体をコード・ログ・チャットへ貼らない。
5. GitHub Environment `development` を作り、下表を登録する。production の secret を継承・コピーしない。
   Environment の required reviewer は承認済み SHA のコード、依存の install script、配信スクリプトを確認する。
   required reviewers は個人 repository の所有者 `kosnu` 本人1人とし、Prevent self-review は無効にする。
   所有者が自分の配信要求を明示承認できる構成にし、管理者の bypass は無効にする。
   protection rule の追加も承認対象。配信操作の権限だけで未レビューコードの実行を許可しない。
   別の承認者や追加の有料 plan は要求しない。所有者本人の承認でも secret は承認完了まで隔離される。
   deployment branch policy は承認対象の PR merge ref と main を許可する必要がある。
6. Dev Supabase Auth の Site URL を代表 Preview の origin に、redirect allow list を各 Preview の
   正確な `https://<preview>-burneto-dev.<subdomain>.workers.dev/auth` に設定する。
   [redirect の仕様](https://supabase.com/docs/guides/auth/redirect-urls)に従い、登録数が増えたときのみ
   account と Worker に限定した `https://b-*-burneto-dev.<subdomain>.workers.dev/auth` を検討し承認を得る。
   `https://*.workers.dev/**` のような広域許可は使わない。Web の `origin + /auth` 経路は維持する。

| 設定                      | GitHub `development` の Secret / Cloud環境変数（同名）           |
| ------------------------- | ---------------------------------------------------------------- |
| Dev API URL               | `VITE_SUPABASE_URL` = `https://ufekmuxkmodwydxmdbln.supabase.co` |
| Dev publishable key       | `VITE_SUPABASE_PUBLISHABLE_KEY`                                  |
| Cloudflare account ID     | `CLOUDFLARE_ACCOUNT_ID`                                          |
| Dev Worker限定の配信token | `CLOUDFLARE_API_TOKEN`                                           |

名前は本番と揃え、値をDev専用にする。productionのEnvironment Secretは自動継承されない。
本番token/keyをコピーせず、所有者がdevelopmentのSecret入力画面へ直接登録する。
旧 `DEV_*` 名での登録案は撤回した。値をチャットやコマンド履歴へ貼らない。

publishable key はブラウザに含まれる公開クライアント用の値。service_role、secret key、DB password、
Supabase access token は frontend 配信に不要。developmentに登録し、DB stepだけに明示的に渡す。
Sentry 送信・source map upload は Preview では無効。

workers.dev URL は秘密 URL でもアクセス制御でもない。JavaScript と合成データを用いた公開検証を
承認してから配信する。private source・非公開文面・実データが含まれる場合は配信を止め、
公開範囲または Access 保護の承認を確認する。noindex は認可の代替にならない。

## 本番と共通の処理とDev固有の差分

本番の `deploy_production.yaml` と同じ `pnpm ci` / `pnpm run web:build`、Supabase token →
`supabase link` → `supabase db push` を使う。本番workflowは変更しない。
Devではnative Preview用のbuild mode/context、専用Worker、共有Dev URLを指定し、Sentryを無効にする。
DBは全Previewへの影響があるためFE配信から分離し、選択PRのmigrationを明示承認後だけ適用する。

独自の配信runner、SQL parser、履歴内容照合、計画hash、Environment APIによるreviewer検査は使わない。
補助コードは `authorize.mjs`（選択PRの固定SHA/branchと現在のPRの照合）と
`preview.mjs`（Cloud/Actions共通の名前とDev設定・成果物の誤配信防止）に限定する。
標準のEnvironment保護設定は管理者が設定・確認する前提で、コードから設定済みとは保証しない。

## Cloud からの配信

この Savings Cloud では `/workspace/.cloud-setup/activate.sh` がruntime/cacheを提供する。
上表のDev環境変数をsecret設定経路から注入する。本番 `.env`、Sentry token、DB管理credentialを
このCloud配信環境へ持ち込まない。公開範囲の承認後、レビュー済みのcleanなbranchをcheckoutして実行する。

```sh
set -e
pnpm ci
preview_branch=$(git branch --show-current)
preview_name=$(node tools/dev-preview/preview.mjs name "$preview_branch")
NODE_ENV=production CLOUDFLARE_PREVIEW_BUILD=true CF_SEND_TELEMETRY=false \
  VITE_SENTRY_DSN= VITE_SENTRY_ENVIRONMENT=development \
  pnpm run web:build --mode development
node tools/dev-preview/preview.mjs check-build
pnpm --filter web exec cf previews deploy "$preview_name" --prebuilt --mode development
git rev-parse HEAD
```

最後の `cf previews deploy` が実配信。buildまでの成功をlive Preview/DB接続の成功とはしない。
detached HEADなら `preview_branch` に対象branch名を指定する。SHAの入力は不要。
短いbranch slugと元のbranch名のSHA-256先頭12桁で名前を作り、同branchは同じURLを更新する。
slash・大小文字・日本語・長い名前が同じslugでも別Previewになる。
CloudとActionsの同名Previewへの同時配信は避ける。最後の完了が勝つため、Actionsの実行状況を先に確認する。

成功したcf応答の `preview_urls` / `deployment_id` とcommitを記録する。URLを推測して成功としない。
通信失敗の場合は配信済みの可能性もあるため、Dev Workerの履歴を確認して再実行を判断する。

## PR Actions からの配信

| 操作       | 起動方法                           | 承認するEnvironment |
| ---------- | ---------------------------------- | ------------------- |
| FE Preview | open PRへ `preview` ラベルを付ける | `development`       |
| 共有Dev DB | open PRへ `dev-db` ラベルを付ける  | `development`       |

ラベルは**初回マージ前にも実行できる入口**として採用する。
[GitHubのpull_request仕様](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request)に従い、
main宛て・同repository・open PRの `labeled` のみを受け付け、merge conflictは先に解消する。
`pull_request_target` は使わない。push/synchronizeやラベルを残したままのpushでは配信しない。
新しいheadを配信する場合はUIからラベルを外して付け直す。`GITHUB_TOKEN`によるラベル付与は起動手段にしない。

main導入後はActionsの各workflowをmainから手動実行し、**PR番号だけ**入力する方法も使える。
CIがその時点のhead SHAとbranchを解決・固定し、承認待ちjob名にSHAを表示する。
fork/closed/main以外のbase、main以外からのdispatchは拒否する。

resolve jobは配信secretを持たない。所有者は固定SHAのworkflow、補助コード、依存install script、
公開内容またはmigration SQLをレビューして、標準のEnvironment承認を行う。
checkoutはそのSHAに固定し、承認後、install/配信credential利用より前に現在のPRを再照合する。
head更新・branch rename・PR close・ラベル撤回なら停止し、新しく要求する。
PR自身がworkflowを変更できるため、保護済みEnvironmentと承認者のコードレビューがcredential境界になる。
設定の未完了や管理者bypassを補助コードで補うものではない。

FEの成功結果はrun Summaryのcf応答とcommitで確認する。PRコメント自動投稿権限は要求しない。
同一PRはconcurrencyで直列化、別PRは並行配信可能。Cloudはこのlockの対象外。
GitHub concurrencyは全待機要求のFIFO保存を保証しないため、置き換えられた要求は再要求する。

## 専用 Dev DB CI

1. 検証するPRに `dev-db` ラベルを付ける（main導入後はPR番号でdispatchも可能）。
2. `development` の承認画面に表示された固定SHAの未適用SQLを確認する。
   他Previewとの互換性、停止枠、削除対象・復旧方法を確認した上で**1回承認**する。
   具体的な破壊操作が未承認ならjobを承認しない。
3. jobはPRを再照合し、Dev refを固定確認して、固定CLI **2.118.0** で次を実行する。
   dry-runはログ確認用で、その後に追加の承認待ちは置かない。承認時点でSQL全文をレビューする。

   ```sh
   supabase link --project-ref "$SUPABASE_PROJECT_ID"
   supabase db push --linked --skip-vault --dry-run
   supabase db push --linked --skip-vault --yes
   ```

4. 成功後、同じPRのheadを変えず `preview` ラベルを付け、FE承認画面のSHAがDB runと同じことを確認する。
   DB完了だけでFEは配信されない。途中でpushした場合は新しいheadのDB差分から確認し直す。

全branchのDB jobは `burneto-shared-dev-database` で承認待ちを含め直列化し、実行中はcancelしない。
Cloud/SQL Editor/MCP等の外部writerはlock対象外なので、CI実行・承認待ち中には書き込まない。
reset/seed/roles/Vault更新、`--include-all`、履歴repair、自動rollbackは実行しない。

### 一度だけ必要な設定（変更は別途承認）

FEとDBは一つの `development` Environmentを使用する。必要なSecretだけを各stepのenvへ明示し、
FEにはDB管理tokenを渡さない。Environment自体でFE/DBのcredentialを隔離する構成ではないため、
承認者はworkflowのSecret参照も確認する。所有者 `kosnu` をrequired reviewerにし、本人の明示承認を可能にするためPrevent self-reviewを無効、
bypassを無効にする。branch policyは `main` と `refs/pull/*/merge` を許可する。
SecretはEnvironmentへ登録し、同名repository Secretで代用しない。

2026-10-03確認のrepositoryは個人所有public。
[GitHub Environmentの制約](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)上、
publicのrequired reviewersはFreeで利用できる。private化やplan変更時は再評価し、無保護へ置き換えない。
新たなEnvironment API読取や追加GitHub PATは必要ない。

FE用4個に加え、DB用の次の2個も `development` のSecretsへ登録する。本番と同じ名前で値はDev専用。

| Secret                  | 値・入力元                                                  |
| ----------------------- | ----------------------------------------------------------- |
| `SUPABASE_PROJECT_ID`   | `ufekmuxkmodwydxmdbln` 固定。link前に一致検査               |
| `SUPABASE_ACCESS_TOKEN` | このDevだけを対象とするscoped PAT。承認後に所有者が直接登録 |

恒久DB password、host、CA PEM、psql設定は不要。一時DB credentialはCLI内部に任せる。
本番も対象のclassic/Legacy PATを転用しない。tokenのscopeはコードで推測せず、所有者が対象project・権限・有効期限を確認する。
[公式権限表](https://supabase.com/docs/guides/platform/personal-access-tokens)と
[固定CLI source](https://github.com/supabase/cli/tree/v2.118.0/apps/cli/src)による必要権限は
Project Settings / API Keys / API Key Secrets / Connection Pooling のRead、DatabaseのRead-write（一時login role発行）。
Storage Config Readは任意probeなので追加しない。
CLIに接続失敗時のnetwork ban解除経路があるため、**Network BansのRead/Read-writeを与えない**。
Network Restrictions、Auth設定、project変更・削除、billing等も追加せず、エラーを理由に自動拡張しない。

CLIの一時login role・IPv4 Session pooler fallback・接続/TLS処理を使う。独自接続runnerは設けない。
`link`はDevのAPI keyを内部で読むため、debugログやキーを報告へ転記しない。
DB workflowは本番と同じ `apps/api` で動く。configのboolean解決用に `SUPABASE_GOOGLE_SKIP_NONCE_CHECK=false` を渡すが、
本番もDevも `config push` は実行せず、hosted Auth provider/redirect設定は変更しない。
GoogleのDev client発行済みでも、GitHubへの保存だけでproviderは設定されない。

### migration互換性と復旧

- CLI標準のversion履歴検査に従う。別branchの適用済みmigrationが不足する等の競合では停止し、
  適用済みファイルを取り込んで未適用migrationを後のversionへ調整し、新しいPR headで再要求する。
- 適用済みSQLは編集・削除しない。**同versionのSQL改変やschema driftをこのCIは検知しない**。
  独自のSQL内容比較・計画hashを廃止したため、標準CLI以上の保証はない。共有DBの変更をこの経路に揃える。
- table/column/RPC追加（expand）→新旧FEの検証→古いPreview終了後に削除（contract）の順にする。
  非互換変更と合成データ損失は対象・影響・復旧方法を具体的に承認する。
- 途中の失敗では一部migrationがcommit済みの可能性がある。自動retryせず、CLI履歴とログで
  成功分/失敗箇所を確認してforward-fixをレビューする。`migration repair`で無理に通さない。
- frontendを以前のcommitへ戻してもDB/Auth/データは戻らない。非互換なら該当Previewを停止し、
  forward-fixで共有schemaの互換性を回復してから新旧FEの読み書き/RLSを再確認する。

### 2026-10-03 の実配信・DB更新の証拠

- [FE Actions 37131668187](https://github.com/kosnu/savings/actions/runs/37131668187) は
  commit `e026361005383809820365a8aa634af90f708555` で成功。
  [PR1871のPreview](https://b-issue-1866-shared-de-fe6897332a30-burneto-dev.coursek8814.workers.dev) と
  deployment `9cf0c299-20d9-4f00-9f49-10cee56049c8` をcfの実応答で確認した。
  最初のrunでは `--quiet` が結果JSONも抑止したため、この指定を除去して同じPreviewへ再配信した。
- [DB Actions 37134186237](https://github.com/kosnu/savings/actions/runs/37134186237) で同じcommitの残り13件を適用し成功。
  対象はDev `ufekmuxkmodwydxmdbln` のみ。初期23件はMCPによる構築で、24件目の削除は一度停止したが、
  古い予算tableの削除・再作成を含む具体的承認後にこのCIで再開した。resetや履歴repairは行っていない。
- 読み取りで **36/36件**、最後のversion `20260905134821`、
  `ensure_authenticated_user(p_initial_display_name text)`、`users.auth_user_id` / `language` の存在を確認した。
  同RPCはauthenticatedのみ実行可能でanon/PUBLICは禁止。全8tableのRLS有効とauthenticatedのSELECT権限も確認した。
- DB更新前は実ログに同RPCの404 / PGRST202があり、引数なしRPCしか存在しなかった。
  更新後のGoogleログイン成功は**ユーザーによる実画面確認の報告**であり、agentによるブラウザ操作の独立確認とは区別する。

[検証用PR1873](https://github.com/kosnu/savings/pull/1873) の別branchも、同じcommitから
[FE Actions 37134854790](https://github.com/kosnu/savings/actions/runs/37134854790) で配信成功。
[2本目のPreview](https://b-issue-1866-preview-c-9721638d04b9-burneto-dev.coursek8814.workers.dev)、
deployment `0c29bbd2-798c-4305-a93c-507cdb45ec48` をcf応答で取得した。DB workflowはスキップ。
この検証用draft/branchはマージ対象ではなく、削除はまだ行っていない。

Cloudからの直接CLI配信は未実施。Cloudには配信用4環境変数がなく、GitHub Secretsの値は取得していない。
またCloudのHTTP接続はproxyのCONNECT 403、Web取得toolもアクセス不可で、agentによるHTTP/UI確認は未完了。
この403をアプリ自身のHTTPエラーとは扱わない。複数branchの実画面、変更後の同branch画面、
複数Preview間の共有データ操作、切戻し後の読み書きの証拠も、未実施のまま成功にしない。

## 合成データ、reset、復旧

初回 seed は Dev 専用テストユーザーでログインし、UI から「検証食費」等のカテゴリ、少数の支払いと
予算を作る。共有アカウントを全員で使わず、検証者ごとのアカウント/default Book に分ける。
固定パスワードや本番メールを commit しない。既存 `bin/init_seed` は接続先・所有モデルを確認せず
共有 Dev に実行しない。frontend 再配信では seed を繰り返さない。

通常の初期化は合成データの対象を決めて UI から行う。全体 reset は全 Preview のデータ・Auth
session・検証結果へ影響する破壊操作であり、自動化しない。管理者は停止対象、失うデータ、保持する
テストユーザー、現在 migration 台帳と必要な Dev バックアップ、再作成する合成 fixture を明示して承認を得る。
必要な場合のみ、Dev project を指す隔離した作業場所で CLI help を確認し、承認済み reset / 復旧手順を実施する。
Free plan の自動バックアップ/PITR は前提にしない。本番バックアップは使用しない。
復旧後は同じ Dev ref、migration 一覧、Auth provider/redirect、table grants/RLS を照合し、
再ログイン・fixture 再作成・新旧 Preview の読み書きを確認して利用再開を通知する。

## Preview の削除と保持

PR merge/close またはブランチの検証終了後、管理者が Preview 名、最後の deployment、
切り戻しの要否を確認して削除承認を得る。cf beta.1 の `previews` は deploy のみを提供するため、
Dashboard の `burneto-dev` の該当 Preview を削除する。本番 Worker・Dev parent・共有 Supabase は削除しない。
正確な Auth redirect を登録した場合は、その Preview の entry だけ削除する承認も確認する。
Preview 削除で共有 DB の合成データは消えない。必要なら所有者とデータ初期化を別に調整する。

## 実機受け入れ確認

セットアップ後に次を記録する。ローカルの fixture テストや Build Output 検査を代用にしない。

| 条件             | 観測する証拠                                                                        |
| ---------------- | ----------------------------------------------------------------------------------- |
| Cloud 配信       | commit / deployment ID、返却 URL、実際の画面変更                                    |
| PR Actions 配信  | PR head SHA と run URL、Summary の URL、画面変更                                    |
| 2ブランチ併存    | A/B の異なる安定 URL、各 commit の違い                                              |
| 同一ブランチ更新 | A の再配信で同じ URL に更新、B は変わらない                                         |
| 共有 Auth/API/DB | A/B とも Dev ref へ通信、Google login 後 `/payments`、A の合成データ更新を B で確認 |
| 本番隔離         | browser の通信先・bundle・設定が Dev のみ。確認のために本番データへアクセスしない   |
| SPA/権限         | `/payments` 直接アクセス、別テストアカウントで他人の Book が見えない                |
| 互換性           | 旧 frontend に切り戻し後も共有 schema 上で読み書き可能、DB 履歴は不変               |

現在の実装だけでは account の初期設定や live 接続の完了を意味しない。各実行時に未確認欄を残す。
