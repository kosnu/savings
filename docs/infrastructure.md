---
title: インフラ構成
doc_type: overview
status: accepted
area: infrastructure
applies_to:
  - apps/web
  - apps/api
topics:
  - cloudflare
  - supabase
  - hosting
  - database
  - branding
  - oauth
  - deployment
when_to_read:
  - ホスティングまたはDNS構成を確認するとき
  - Supabase AuthまたはPostgreSQLの利用前提を確認するとき
---

# インフラ構成

本プロジェクトの Web アプリケーションは、以下のクラウドサービスを利用して構築・運用されています。

## 利用サービス一覧

- **Cloudflare Workers Static Assets**
  - Web アプリケーション（React SPA）のホスティングに利用。
  - HTTPS 対応、CDN による高速配信。
  - リポジトリの移管後設定。本番切替は[移管手順](workers-migration.md)の承認・確認後に実施。
- **Cloudflare Domain**
  - 独自ドメインの管理に利用。
  - DNS 設定や SSL 証明書の管理も Cloudflare で実施。
- **Supabase Auth**
  - ユーザー認証（メール/パスワード、Google ログイン等）に利用。
  - セキュアな認証基盤を提供。
- **Supabase PostgreSQL**
  - リレーショナルデータベースとして利用。
  - ユーザーデータやアプリケーションデータを保存。

## 構成図

```
[User]
  │
  ▼
[Cloudflare Domain] ──> [Workers Static Assets] ──> [Web App (React SPA)]
                                                    │
                                                    ▼
                                              [Supabase]
                                                ├─> [Auth]
                                                └─> [PostgreSQL]
```

## 外部サービスのブランド構成

### Google OAuth

- Google Cloud project と OAuth 同意画面のアプリ名は `Burneto` とする。
- OAuth 同意画面のロゴには、[#1774](https://github.com/kosnu/savings/issues/1774) で作成した正方形の
  [ブランドアイコン](../apps/web/public/brand/icon-master.png)を使用する。
- Web application の OAuth client は Supabase 用として管理し、次の URI を登録する。
  - Authorized JavaScript origins: `http://localhost:5173`、`https://burneto.com`
  - Authorized redirect URIs: `http://localhost:54321/auth/v1/callback`、
    `https://izuzqvgvgquqqimwuygw.supabase.co/auth/v1/callback`
- OAuth client ID と client secret は Supabase および GitHub Environment のsecretで管理し、
  リポジトリへ保存しない。

### Cloudflare Workers Static Assets

- Worker 名は `burneto`、本番 custom domain は `burneto.com` とする。
- [cloudflare.config.ts](../apps/web/cloudflare.config.ts) が配信先と SPA fallback を所有する。
  静的ファイルのみを配信し、Worker のサーバーコードを追加しない。
- Cloudflare Vite plugin が既存の Web ビルドから `.cloudflare/output/v0/` を作成する。
  [deploy_production.yaml](../.github/workflows/deploy_production.yaml) は cf を使い、
  `--prebuilt --mode production` で同じ成果物を検証・配信する。
- 旧 Pages project `burneto`、既存 deployment、`savings-dyo.pages.dev` は切り戻し用に保持する。
  本番切替後も旧 hostname は旧 Pages を配信し、Workers への転送先にはしない。
- 本番切替と旧 Pages 削除は別の承認対象とする。準備・切替・確認・切り戻しは
  [移管手順](workers-migration.md)を参照する。

### Supabase

- Dashboard上のproject表示名は `Burneto` とする。
- Project IDと `*.supabase.co` URLはAPI・認証callbackの識別子なので変更しない。
  Free planではcustom domainを追加せず、Google OAuth中に表示されるSupabase URLは
  認証基盤のURLとして維持する。
- Google providerは有効のまま維持し、Google Auth PlatformのSupabase用OAuth clientを使用する。
- Site URLは `https://burneto.com/`、redirect allow listは
  `https://burneto.com/auth` とする。

### Authentication redirect

Googleログインのredirectは次の順序を維持する。

1. Web Appが現在のoriginの `/auth` を `redirectTo` に指定する。
2. Google OAuthがSupabaseの `/auth/v1/callback` へ戻す。
3. Supabaseがallow list内の `/auth` へ戻す。
4. Web Appが認証済みsessionを確認して `/payments` へ遷移する。

変更後は、既存sessionで `/auth` から `/payments` へ遷移することに加え、Googleログインを開始して
同意画面にBurnetoの名称とロゴが表示され、callback後に `/payments` へ到達することを確認する。

### Preserved boundaries

- Googleログインのproviderと認証経路を変更しない。
- Supabase Project ID、database、RLS policy、利用者ごとのデータ分離を変更しない。
- brand表示の変更を理由にOAuth client secretを再生成しない。

### Production deployment

`Deploy Production` は手動実行とする。Workers への初回切替は
[#1867](https://github.com/kosnu/savings/issues/1867) と[移管手順](workers-migration.md)に従い、
対象 commit と実施内容への承認を得てから行う。
Web ビルドでは従来の Supabase・Sentry 環境変数を維持する。
本番で既存 session、Google ログイン、SPA の直接アクセス、Sentry の受信と source map 解決を確認する。

### Development previews

共有 Dev Supabase project を1つ用意し、DB・Auth・Data API を全ブランチで共有する。
本番 project、データ、OAuth 設定から分離し、合成データだけを使う。
フロントエンドは専用 Worker `burneto-dev` の native Previews で配信する。
`cloudflare.config.ts` は Preview context または development mode で本番 domain を外す。
Cloud と PR の preview ラベルから起動する GitHub Actions が同じ配信スクリプトを使用する。
利用者は PR を選び、SHA は CI が内部で解決・固定する。main 導入後は PR 番号だけの手動実行も使える。Actions は既存 development
Environment の所有者本人による required review（自己承認可）を確認し、承認後も対象 SHA を再照合する。
プレビュー配信は migration、seed、reset、Auth 設定の変更を行わない。
DB 変更は別の dev-db ラベルで専用 CI を起動し、選択 branch の計画確認・所有者承認後に適用する。
DB 用 Environment を分離し、全 branch を直列化、履歴競合や計画変更は停止する。
マージ前に新 table を適用してから、同じ PR head の FE を配信できる。
初期設定、公開範囲、共有 DB の適用・復旧、削除条件と実機検証は
[Dev プレビュー運用](development-preview.md)を参照する。

DevのSecret名は本番と揃え、値とEnvironmentを分離する。DBはDev限定 `SUPABASE_ACCESS_TOKEN` と
`SUPABASE_PROJECT_ID` によるCLI link/db pushを使う。恒久DB password・host・CA登録は不要。
具体的なscopeと承認、FE/DBのEnvironment分離は[開発Preview運用](development-preview.md)を参照する。
