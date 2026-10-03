---
title: PagesからWorkers Static Assetsへの移管手順
doc_type: runbook
status: accepted
area: infrastructure
applies_to:
  - .github/workflows/deploy_production.yaml
  - apps/web/cloudflare.config.ts
  - apps/web/vite.config.ts
topics:
  - cloudflare
  - hosting
  - deployment
  - rollback
when_to_read:
  - Workersへの本番切替や切り戻しを実施するとき
  - cfによるWebデプロイを確認するとき
---

# PagesからWorkers Static Assetsへの移管手順

この手順は [Issue #1867](https://github.com/kosnu/savings/issues/1867) の移管を扱う。
リポジトリの配信設定を Workers に揃えても、本番切替の完了を意味しない。
本番切替と旧 Pages 削除には、それぞれ具体的な実施内容への承認が必要になる。
ブランチ単位の Dev 環境は対象外とする。

## 配信構成

- Worker: `burneto`。Custom Domain: `burneto.com`。
- `apps/web/cloudflare.config.ts` は assets-only Worker と
  `notFoundHandling: "single-page-application"` を指定する。
  `/payments`、`/auth` などへの直接アクセスは `index.html` を返し、既存のクライアント router が処理する。
- Pages 用の `public/_redirects` は native SPA fallback に置き換える。
- cf は `1.0.0-beta.1`、Cloudflare Vite plugin は `2.0.0-beta.sha-805ec1ff3` に固定する。
  共通の `@cloudflare/config` は `0.18.0`。7 日間の release age を満たす組み合わせを採用する。
  Node はリポジトリ指定の `26.10.0`、pnpm は `12.7.0` を使う。
  Compatibility Date `2026-09-18` は同梱 workerd が対応する日付に固定する。
- 従来の `tsc -b` と Vite のビルドを維持し、build と preview で Cloudflare plugin を有効化する。
  配信物は `apps/web/.cloudflare/output/v0/`。Wrangler の直接依存と wrangler-action は使用しない。
- Sentry は本番ビルド時に配信物へ Debug ID を注入し、同じ出力内の source map をアップロード・削除する。
  cf の `--prebuilt` により再ビルドせず、その配信物をデプロイする。
- 旧 Pages project `burneto` と `savings-dyo.pages.dev` は切り戻し先として保持する。
  旧 hostname は移管しない。Supabase の redirect allow list に追加せず、新しい認証入口にも使用しない。

## 切替前の準備

1. 対象 commit、Worker 名、Cloudflare account、`burneto.com` の zone と現在の DNS record を確認する。
   同名の既存 Worker がある場合は、その用途を確認してから進める。
2. Pages project `burneto` の現在の production deployment ID、commit、Custom Domain と DNS record を記録する。
   `savings-dyo.pages.dev` が旧配信物を返すことを確認する。既存 deployment を削除・更新しない。
3. GitHub Environment `production` の `CLOUDFLARE_ACCOUNT_ID` と `CLOUDFLARE_API_TOKEN` を確認する。
   Pages 用 token のままでは Workers の権限が不足する場合がある。
   対象 Worker の編集権限と、Custom Domain を変更する `burneto.com` zone の
   `Workers Routes Write` 権限を確認する。具体的な token の権限は Cloudflare 側で確認し、値を記録へ転載しない。
4. `VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY`、`VITE_SENTRY_DSN`、
   `SENTRY_AUTH_TOKEN`、`SENTRY_ORG`、`SENTRY_PROJECT` を既存値のまま維持する。
   Supabase Site URL `https://burneto.com/`、redirect allow list `https://burneto.com/auth`、
   Google の Supabase callback を変更しない。同じ origin と Supabase project により既存 session の保存先を維持する。
5. ローカルで必要な Web 検証とビルドを実施する。次のコマンドはリポジトリルートで実行する。

```bash
pnpm ci
pnpm run web:build
pnpm --filter web exec cf deploy --prebuilt --mode production --dry-run
pnpm --filter web preview --host 127.0.0.1
```

`--dry-run` はアップロードや Cloudflare API 呼出しを行わない。
preview は Workers runtime でビルド済みの静的ファイルを配信する。
HTML navigation の `/`、`/payments`、`/auth`、`/privacy` の応答と再読み込み、
HTML が参照する JS/CSS、favicon の応答を確認する。
Sentry 有効ビルドの配信ディレクトリに `.map` が残らないことも確認する。

## 承認後の本番切替

承認対象は、対象 commit の Workers 配信、Pages の `burneto.com` 紐付け解除、
Worker `burneto` への同一ドメインの紐付け、および本番動作確認とする。
ドメイン解除から Workers の DNS/証明書の準備が終わるまで、一時的なアクセス失敗があり得る。
切り戻し先を確認した上で、承認された作業時間に実施する。

1. 対象 commit の CI と事前検証を確認する。切替前に既存のログイン済みブラウザを維持しておく。
2. Cloudflare Dashboard の Pages project `burneto` から `burneto.com` の Custom Domain を解除する。
   旧 Pages project、deployment、`savings-dyo.pages.dev` は保持する。
3. GitHub Actions の `Deploy Production` を、承認された commit を含む ref で手動実行する。
   既存 workflow は Supabase job の後に Web job を実行するため、API 側に未承認の migration が含まれない ref を使う。
   Web job は一度だけビルドし、cf の dry-run 後に同じ配信物をデプロイする。
   `cloudflare.config.ts` の `domains` が `burneto.com` を Worker へ紐付ける。
   既存 DNS record の競合があれば現在値と切り戻し記録を照合し、対象外の record を変更しない。
4. workflow の成功、Worker の active version、Custom Domain の証明書と DNS を read-back する。
   `https://burneto.com/` と `/payments` を確認する。失敗時は切り戻す。

## 本番での完了確認

- `/` の表示、`/payments` の直接アクセス・再読み込み、既存の画面操作が正常に動く。
- 切替前からログインしていた同じブラウザで、session を消去せず `/payments` を利用できる。
- Google ログインを開始し、Supabase callback → `https://burneto.com/auth` → `/payments` に到達する。
- Actions の対象 commit と Worker の version が対応し、対象の静的ファイルが配信される。
- Sentry に本番イベントが届き、その Debug ID とアップロード済み map により元のソース位置を解決できる。
  配信ディレクトリに map が残らず、同じ map URL が source map として公開されない。
- `savings-dyo.pages.dev` の旧 deployment が残っている。

各確認の実施日時、commit、Worker version、workflow run、結果と不足を記録する。
OAuth の token、session、secret や実ユーザーのデータは記録へ転載しない。
本番確認が揃うまで Issue の完了条件を達成済みにしない。

## 切り戻し

本番切替が失敗した場合は、承認した切替の復旧として次を実施する。

1. 新しい `Deploy Production` 実行を止める。
2. Worker `burneto` の `burneto.com` Custom Domain を外す。
3. 旧 Pages project `burneto` に同じ Custom Domain を再追加し、記録した旧 DNS record と deployment を復元する。
   旧 deployment が維持されていれば、再ビルドや DB 操作は不要。
4. DNS/証明書と、旧配信の表示・直接アクセス・既存 session・Google ログインを確認する。
5. Workers 用 workflow を再実行すると再度ドメインを紐付けるため、原因修正と再切替承認まで実行しない。

旧 Pages の削除は切替承認に含めない。本番の完了確認が揃った後に、切り戻し先を失う影響と
旧 hostname の停止を明示し、削除への別の承認を得て実施する。

## 参照

- [Pages から Workers への移行](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/)
- [cf の CI 利用](https://developers.cloudflare.com/cf/ci/)
- [cf の programmatic configuration](https://developers.cloudflare.com/cf/projects/cloudflare-config/)
- [Workers の SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
- [Workers の Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [Workers の権限](https://developers.cloudflare.com/workers/authorization/workers/)
