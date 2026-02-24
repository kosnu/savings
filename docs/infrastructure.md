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
- **Supabase Edge Functions**
  - バックエンド API（Deno + Hono）として利用。
  - 各機能（payments, categories）を独立した Edge Function として提供。

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
                                                ├─> [PostgreSQL]
                                                └─> [Edge Functions (API)]
```
