# インフラ構成

本プロジェクトの Web アプリケーションは、以下のクラウドサービスを利用して構築・運用されています。

## 利用サービス一覧

- **Firebase Hosting**
  - Web アプリケーションのホスティングに利用。
  - HTTPS 対応、CDN による高速配信。
- **Firebase Authentication**
  - ユーザー認証（メール/パスワード、Google ログイン等）に利用。
  - セキュアな認証基盤を提供。
- **Cloud Firestore**
  - NoSQL データベースとして利用。
  - ユーザーデータやアプリケーションデータを保存。
- **CloudFlare Domain**
  - 独自ドメインの管理に利用。
  - DNS 設定や SSL 証明書の管理も CloudFlare で実施。

## 構成図（例）

```
[User]
  │
  ▼
[CloudFlare Domain] ──> [Firebase Hosting] ──> [Web App]
                                      │
                                      ├─> [Firebase Authentication]
                                      └─> [Cloud Firestore]
```
