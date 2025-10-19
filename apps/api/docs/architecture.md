# Clean Architecture for TypeScript + Hono Backend (Cloudflare D1 + Drizzle)

このドキュメントは、Cloudflare Workers 上で動作する
**TypeScript + Hono + Drizzle ORM + D1** 構成のバックエンドアプリケーションにおける
**クリーンアーキテクチャ設計**のガイドラインです。

---

## 🎯 目的

本アーキテクチャの目的は以下の通りです：

- フレームワーク（Hono）や ORM（Drizzle）への依存を最小限に保ち、ビジネスロジックを純粋に保つ
- 各層の責務を明確にし、依存方向を一方向に統制する
- Cloudflare Workers 環境に最適化された構成を提供する
- ローカル開発環境（SQLite / libsql）と本番環境（D1）を柔軟に切り替えられるようにする

---

## 🏗️ アーキテクチャ概要

本構成はクリーンアーキテクチャの原則に基づき、4 層に分かれています。なお、Shared は横断的な共通層であり、層数には含めていません。

```
# 依存の向き（矢印は「依存する」を示します）
interfaces ─▶ application ─▶ domain
                ▲
infrastructure ─┘  （Infrastructure は domain の抽象に依存し、具象実装を提供します）
```

### 層構造の概要

| 層                 | 役割                   | 外部依存        | 主な責務                                 |
| ------------------ | ---------------------- | --------------- | ---------------------------------------- |
| **Domain**         | ビジネスエンティティ層 | ❌              | Entity 定義・Repository インターフェース |
| **Application**    | ユースケース層         | ❌              | ビジネスロジック（UseCase）              |
| **Infrastructure** | 永続化・外部 I/O 層    | ⚠️ Drizzle / D1 | Repository 実装・DB アクセス             |
| **Interfaces**     | 入出力層               | ✅ Hono         | HTTP ルート・ハンドラ・DI                |
| **Shared**         | 共通層                 | ❌              | 共通型・ユーティリティ・エラー定義       |

---

## 🗂️ ディレクトリ構成

```
src/
├── domain/               # ビジネスエンティティ & リポジトリ定義
│   └── {Aggregate root}/
│       ├── entities/
│       ├── valueObjects/
│       ├── services/
│       └── repository.ts
│
├── application/          # ユースケース（ビジネスロジック）
│   └── {Aggregate root}/
│       ├── dtos/
│       └── usecases/
│
├── infrastructure/       # 外部システム連携（DBなど）
│   ├── db/
│   │   ├── client.ts      # D1 / SQLite クライアント管理
│   │   └── schema.ts      # Drizzle ORM スキーマ
│   └── {Aggregate root}/
│       └── {Aggregate root}RepositoryImpl.ts
│
├── interfaces/           # Honoルート・ハンドラ
│   ├── handlers/
│   │   └── {Aggregate root}Handler.ts
│   ├── routes/
│   │   └── {Aggregate root}Route.ts
│   └── server.ts          # Honoアプリ初期化
│
├── shared/               # 共通関数・型
│   ├── errors.ts
│   └── types.ts
│
└── index.ts              # エントリーポイント
```

---

## 🧩 各層の詳細

### 1. Domain 層（ビジネスエンティティ層）

- **責務**
  - アプリケーションの中心的なビジネスルールを定義
  - 外部の技術的要素に依存しない
- **構成要素**
  - `Entity`: ビジネスデータの構造（例：Payment, User）
  - `Repository Interface`: データアクセスの抽象化

> この層には、Drizzle や Hono などのライブラリ依存を一切含めない。

---

### 2. Application 層（ユースケース層）

- **責務**
  - Domain 層で定義されたエンティティを操作し、アプリ固有のユースケースを実現
  - 入出力 DTO（Data Transfer Object）を定義し、インターフェース層との境界を明確にする
- **構成要素**
  - `UseCase`: 具体的な操作（例：支払い作成、一覧取得など）
  - `DTO`: データ変換用オブジェクト

> ここでもフレームワークや ORM には依存しない。

---

### 3. Infrastructure 層（永続化層）

- **責務**
  - DB や外部 API などの実際の実装を担当
  - Domain 層の `Repository Interface` を実装
  - Cloudflare D1（本番）または SQLite/libsql（開発）と接続
- **構成要素**
  - `db/client.ts`: Drizzle ORM クライアント生成
  - `db/schema.ts`: テーブル定義
  - 各 Repository 実装クラス（例：`PaymentRepositoryImpl`）

> この層は最も外側にあり、環境依存のコードを隔離する。

---

### 4. Interfaces 層（入出力層）

- **責務**
  - HTTP 通信を受け取り、Application 層のユースケースを呼び出す
  - Hono のルーティング定義・リクエスト/レスポンス変換を行う
- **構成要素**
  - `handlers/`: ユースケース呼び出しロジック
  - `routes/`: Hono ルート定義
  - `server.ts`: Hono アプリの初期化とルート統合

> Hono への依存はこの層に限定する。

---

### 5. Shared 層（共通層）

- **責務**
  - すべての層で再利用可能なコードを配置
  - 共通の型定義、エラーハンドリング、ユーティリティなど
- **構成要素**
  - `errors.ts`: 共通エラークラス
  - `types.ts`: 共通型
  - `utils.ts`: 汎用ユーティリティ関数

---

## 🔁 依存関係の流れ

依存方向は**内側にのみ向かう**ように設計します。

```
infrastructure ─┐
▼
domain ◀── application ◀── interfaces
```

- Domain は他層に依存しない
- Application は Domain のみに依存
- Infrastructure は Domain に依存し、Application から注入される
- Interfaces は Application を利用し、Hono などの外部依存を持つ

---

## 🧱 依存注入（DI）の考え方

- Hono ルート定義内で `RepositoryImpl` → `UseCase` → `Handler` の順に組み立てる
- DI コンテナを使わず、**ルート単位の明示的な DI**を採用
- Cloudflare Workers の `c.env` を利用して `D1` インスタンスを渡す

---

## ⚙️ 環境構成

### Production

- Cloudflare Workers 上で稼働
- D1 データベースを `Env.DB` 経由で注入

### Local Development

- Docker 上またはローカルで `libsql` / `better-sqlite3` に接続
- `.env` に `DATABASE_URL` を指定
- 同一 `infrastructure/db/client.ts` で接続先を動的に切り替える

---

## 🧭 運用上のベストプラクティス

1. **Hono 依存を `interfaces/` に閉じ込める**
2. **ORM 依存を `infrastructure/` に閉じ込める**
3. **DTO と Entity を混在させない**
4. **Domain 層を純粋に保つ（テスト容易性の確保）**
5. **テストは層単位で実施する**
   - Domain 層はユニットテスト
   - Application 層はモックを利用
   - Interfaces 層は E2E テスト

---

## 📘 まとめ

| 層                 | フォルダ          | 主な責務                         | 外部依存     |
| ------------------ | ----------------- | -------------------------------- | ------------ |
| **Domain**         | `domain/`         | エンティティ定義、リポジトリ抽象 | なし         |
| **Application**    | `application/`    | ユースケースロジック             | Domain       |
| **Infrastructure** | `infrastructure/` | データ永続化、DB 接続            | Drizzle / D1 |
| **Interfaces**     | `interfaces/`     | Hono ルート・ハンドラ            | Hono         |
| **Shared**         | `shared/`         | 共通型・エラー・ユーティリティ   | 任意         |

---

## 🧩 参考技術スタック

| 分類               | 採用技術                       |
| ------------------ | ------------------------------ |
| フレームワーク     | Hono                           |
| ORM                | Drizzle ORM                    |
| データベース       | Cloudflare D1 / SQLite(libsql) |
| 実行環境           | Cloudflare Workers             |
| 言語               | TypeScript                     |
| Linter / Formatter | Biome（推奨）                  |

---

## 🪶 Appendix: 開発フロー概要

1. `domain/` に Entity と Repository Interface を定義
2. `application/` に UseCase を定義（Domain のみ参照）
3. `infrastructure/` に Repository の具象実装を追加
4. `interfaces/` に Handler と Route を作成
5. `index.ts` で Hono アプリを export
6. `wrangler dev` で Cloudflare 環境を起動

---

**この構成のゴール：**

- コードの関心分離
- 変更影響範囲の明確化
- フレームワーク依存の局所化
- 長期的な保守性とテスト容易性の両立
