# インフラ構成

本プロジェクトのWebアプリケーションは、以下のクラウドサービスを利用して構築・運用されています。

## 利用サービス一覧

- **Firebase Hosting**
  - Webアプリケーションのホスティングに利用。
  - HTTPS対応、CDNによる高速配信。

- **Firebase Authentication**
  - ユーザー認証（メール/パスワード、Googleログイン等）に利用。
  - セキュアな認証基盤を提供。

- **Cloud Firestore**
  - NoSQLデータベースとして利用。
  - ユーザーデータやアプリケーションデータを保存。

- **CloudFlare Domain**
  - 独自ドメインの管理に利用。
  - DNS設定やSSL証明書の管理もCloudFlareで実施。

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
