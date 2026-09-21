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

- **Cloudflare Pages**
  - Web アプリケーション（React SPA）のホスティングに利用。
  - HTTPS 対応、CDN による高速配信。
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
[Cloudflare Domain] ──> [Cloudflare Pages] ──> [Web App (React SPA)]
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

### Cloudflare Pages

- 既存の Pages project を継続利用し、project名は `burneto` とする。
- project名はCloudflare DashboardとWrangler CLIの識別子であり、改名自体は既存のhostname、
  deployment、custom domainを変更しない。
- 本番custom domainには別途追加した `burneto.com` を使用する。Pagesが生成した既存の
  `savings-dyo.pages.dev` hostnameは維持する。
- GitHub Actionsのデプロイ先は
  [deploy_production.yaml](../.github/workflows/deploy_production.yaml) の
  `--project-name=burneto` と一致させる。

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

外部サービス設定とリポジトリ設定を揃えた後の本番デプロイと本番Googleログイン確認は、
[#1778](https://github.com/kosnu/savings/issues/1778) で実施する。#1776では
`Deploy Production` workflowを実行しない。
