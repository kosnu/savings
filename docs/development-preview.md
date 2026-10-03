---
title: Dev プレビュー運用
doc_type: overview
status: accepted
area: infrastructure
applies_to:
  - tools/dev-preview
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
`cf previews deploy <name> --prebuilt --mode development --quiet` が native Previews を配信し、
JSON に `preview_urls` と `deployment_id` を返す。plugin は
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
2. 下記の共有 DB 手順で、レビュー済み main の完全 SHA から migration を適用する。
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

| 設定                  | GitHub development                    | Cloud の環境変数           |
| --------------------- | ------------------------------------- | -------------------------- |
| Dev project ref       | variable `DEV_SUPABASE_PROJECT_REF`   | `DEV_SUPABASE_PROJECT_REF` |
| Dev publishable key   | secret `DEV_SUPABASE_PUBLISHABLE_KEY` | 同名                       |
| Cloudflare account ID | variable `DEV_CLOUDFLARE_ACCOUNT_ID`  | `CLOUDFLARE_ACCOUNT_ID`    |
| 承認済み配信 token    | secret `DEV_CLOUDFLARE_API_TOKEN`     | `CLOUDFLARE_API_TOKEN`     |

publishable key はブラウザに含まれる公開クライアント用の値。service_role、secret key、DB password、
Supabase access token は frontend 配信に不要。DB 運用者が別に保管し、PR runner に渡さない。
Sentry 送信・source map upload は Preview では無効。

workers.dev URL は秘密 URL でもアクセス制御でもない。JavaScript と合成データを用いた公開検証を
承認してから配信する。private source・非公開文面・実データが含まれる場合は配信を止め、
公開範囲または Access 保護の承認を確認する。noindex は認可の代替にならない。

## Cloud からの配信

repo root で指定 Node/pnpm と frozen lockfile の依存を用意し、上表の承認済み環境変数を設定する。
この Savings Cloud では `/workspace/.cloud-setup/activate.sh` が runtime と cache の設定を提供する。
環境変数は secret 設定経路から注入し、コマンド履歴へ値を残さない。

```sh
pnpm ci
node tools/dev-preview/deploy.mjs
```

現在の checkout を毎回ビルドして配信する。未コミット変更も含むため、再現可能な検証は clean な
レビュー済み commit で行い、表示された commit と差分有無を記録する。
detached HEAD では対象ブランチ名を明示する。

```sh
node tools/dev-preview/deploy.mjs issue-1866/shared-dev-preview
```

ブランチ名の短い slug + 元の名前の SHA-256 先頭12桁が Preview 名になる。
同じブランチは同じ URL を更新し、slash・大小文字・日本語・長い名前が同じ slug になっても区別する。
Cloud と Actions の同時配信は行わない。同名 Preview への同時実行は最後の完了が勝つため、
Cloud から配信する前に Actions の同 PR 実行がないことを確認する。

配信前のローカル検証のみなら次を使う。これは DB 接続・ライブ Preview の成功証拠ではない。

```sh
node --test tools/dev-preview/preview.test.mjs tools/dev-preview/authorize.test.mjs
node tools/dev-preview/deploy.mjs --build-only
```

実配信に成功した場合だけ cf の応答から安定 Preview URL、commit、deployment ID を報告する。
通信失敗や JSON 不一致では、配信が成功済みの可能性もある。Dashboard の Dev Preview 履歴を確認してから
再実行を判断し、URL を推測して成功としない。

## PR からの配信

### PR ラベルによる明示配信（初回マージ前にも利用可能）

1. 同一 repository の main 宛て open PR で、配信対象の完全 head SHA と変更をレビューする。
2. `preview:<40桁の小文字head SHA>` ラベルを UI から明示的に付ける（計48文字）。
   例の SHA を流用せず、その PR の現在値を使用する。ラベル作成・付与はこの workflow 自体では行わない。
3. `Deploy Dev Preview` の run 名と承認待ち job 名で SHA を確認する。所有者本人が
   その SHA の workflow、gate、依存 install script、frontend と公開内容を確認して `development` を承認する。
4. 成功後、run Summary の URL と配信 commit を確認し、実画面を検証する。

[GitHub の pull_request 仕様](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request)に従い
`labeled` のみで起動する。default branch に workflow がない初回 PR も対象にできるが、merge conflict は先に解消する。
`pull_request_target` は使わない。push/synchronize、別ラベル、fork、main 以外の base では配信しない。
新しい head には新しい SHA のラベルを付け直し、毎回 Environment 承認を受ける。
ラベルを残しても次の push は配信されない。同一 SHA の再実行はラベルを外して再付与するか run を再実行し、再承認する。
`GITHUB_TOKEN` によるラベル付与は次の workflow を起動しないため、自動付与を起動手段にしない。

resolve job は配信 secret を持たず、GitHub API で open/same-repo/main/current head と対象ラベルを照合する。
さらに既存 `development` の required reviewers が個人所有者本人1人で、Prevent self-review が無効であることを
読み取り確認する。未設定、404/403、通信障害、保護不足なら deploy job に進まず、Environment を自動作成しない。
[Environment API](https://docs.github.com/en/rest/deployments/environments#get-an-environment)の読み取りに
`actions: read`、PR 照合に `pull-requests: read`、checkout に `contents: read` を使用し、書込権限・追加 PAT は要求しない。
承認後、依存のインストールや配信 token の利用より前に同じ条件を再確認する。
head 更新・branch rename・PR close・ラベル撤回なら停止し、checkout は解決した完全 SHA のみに固定する。
再検証用コードを取得する checkout は先に行うが、依存のインストール・配信 credential の投入は再検証後に限る。

Environment の管理者変更や bypass を workflow のコードだけで防ぐことはできない。
secret は必ず保護済み Environment に置き、同名 repository secret を代用しない。
PR が workflow 自体を変更できるため、承認者は実際に実行される workflow 差分もレビューする。
所有者の reviewer 登録、保護設定、Dev 資源・認証情報、公開承認が未準備なら初回の実配信は未検証のまま停止する。
fixture テストを Actions の実配信証拠へ置き換えず、AIDD の実機条件も unknown を維持する。

### 公開範囲・プランと API 権限

2026-10-03 の GitHub repository metadata では `kosnu/savings` は個人所有の **public**。
アカウントの契約 plan 自体は取得できていないが、public の required reviewers は Free を含む現行 plan で利用できる。
[GitHub の Environment 制約](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)では、
private の Free は Environment secrets 自体が使えず、private の Pro/Team でも required reviewers は使えない。
private 化した場合に同じ経路を無料で使えるとはしない。課金や公開化を自動で提案・実行せず、
承認済み Cloud 経路を使うか、trusted main 起点の別の承認方式を設計する。無保護の repository secret への置換はしない。

Environment の GET/list に必要な権限は公式 API 上 `actions: read`。
`Dev Preview CI` は実際の `GITHUB_TOKEN` で metadata 一覧の GET を行い、レスポンス本文を出力せず読取可否を検証する。
これは設定変更でも保護設定の完了確認でもない。Cloud の接続プロキシによる403と GitHub runner の権限拒否を区別する。
もし runner でも403になる場合は権限不足を隠して通さず、原因を確認する。新しい PAT/追加 grant を自動要求・作成しない。

### main からの手動実行

workflow を main へ取り込んだ後は `workflow_dispatch` も使用できる。
Actions の `Deploy Dev Preview` を main から実行し、open PR 番号とレビューした head の40桁 SHA を指定する。
main 以外からの dispatch、fork、closed PR、異なる base/head は拒否し、同じ Environment 保護確認と承認を通す。
この経路は default branch への導入が前提なので、初回マージ前の Actions 検証には上の PR ラベル経路を使う。
マージ済み PR 自体は open 条件を満たさないため、導入後の dispatch 確認には別の open PR が必要になる。

両経路とも結果 URL は run の Summary とログで確認する。PR コメントの自動投稿権限は要求しない。
同一 PR は共通 concurrency group で直列化し、別 PR は並行可能。Cloud との同時配信は手動で避ける。

## 共有 DB の migration と互換性

Preview 配信には Supabase CLI 呼び出しがない。DB 変更は担当者1人が管理し、Cloud と CI の
複数箇所から同時実行しない。適用台帳（Issue 等）へ Dev ref、main SHA、migration 一覧、
適用者、時刻、影響する Preview、検証結果と復旧方針を残す。秘密値・実データは記録しない。

1. レビュー済み main の clean checkout と完全 SHA を固定する。未マージ branch の migration は
   デプロイ時に適用しない。schema が不足する branch は、互換 migration が main に入り、
   共有 DB に適用されるまで該当機能の検証を待つ。
2. 利用中 Preview と旧 frontend の互換性を確認する。追加 column / 新 RPC を先に入れる
   expand → frontend 更新 → 利用中の旧 Preview がなくなってから contract の順にする。
   破壊変更は事前調整した停止枠と復旧手順への明示承認が必要。
3. Dev project ref と接続先を二重確認し、適用予定を読み取りで確認する。CLI は repo の
   `supabase 2.118.0` を使う。環境変数の `SUPABASE_ACCESS_TOKEN` と `SUPABASE_DB_PASSWORD` は
   Dev 運用者だけが保持する。事前に `--help` で固定版のオプションを確認する。

```sh
# DEV_SUPABASE_PROJECT_REF は管理画面で照合済みの Dev ref のみ。
test "$DEV_SUPABASE_PROJECT_REF" != izuzqvgvgquqqimwuygw
test -n "$DEV_SUPABASE_PROJECT_REF"
pnpm exec supabase migration list --workdir apps/api --project-ref "$DEV_SUPABASE_PROJECT_REF"
pnpm exec supabase db push --workdir apps/api --project-ref "$DEV_SUPABASE_PROJECT_REF" --skip-vault --dry-run
# 影響・適用一覧・復旧方法を承認後、同一 SHA・単一担当で実行。
pnpm exec supabase db push --workdir apps/api --project-ref "$DEV_SUPABASE_PROJECT_REF" --skip-vault
pnpm exec supabase migration list --workdir apps/api --project-ref "$DEV_SUPABASE_PROJECT_REF"
```

4. `--include-all`、`--include-seed`、`--include-roles`、migration repair を日常手順に含めない。
   履歴の不一致・順序逆転・途中失敗は止めて適用履歴を確認する。
5. 新旧 Preview で認証、取得、保存、RLS を確認する。CLI 成功と画面・API 成功を区別する。

frontend を以前の commit に戻して同じ Preview へ再配信しても、DB・Auth・データは戻らない。
旧 frontend と現 schema が互換なら frontend だけ戻す。非互換なら該当 Preview の利用を止め、
原則としてレビューした forward-fix migration で互換性を回復する。履歴だけの巻き戻しはしない。

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
