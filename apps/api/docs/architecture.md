# Architecture Overview

このドキュメントは、Supabase Edge Functions 上で動作するクリーンアーキテクチャ原則に基づくサーバーサイドアプリケーションの設計指針を示します。
開発者やアーキテクトが技術的な詳細に影響されずに設計・実装できることを目的としています。

## 実行環境

- **ランタイム**: Deno 2.x (Supabase Edge Functions)
- **HTTP フレームワーク**: Hono
- **データベース**: PostgreSQL (Supabase)
- **認証**: Supabase Auth (JWT 検証)

---

## 目的

- ビジネスロジック（ドメイン）を外部技術から分離して保守性を高める
- 入出力や永続化などの技術的関心事をアプリケーションの周辺に閉じ込める
- フレームワークやライブラリの変更に強い設計を実現する

## 概要（高レベル）

設計の中心はクリーンアーキテクチャで、依存の方向は内側（ビジネスルール）に向かいます。

```
interfaces ─▶ application ─▶ domain
                ▲
infrastructure ─┘
```

各層の責務は以下の通りです。

- Domain（ドメイン）: ビジネスエンティティ、値オブジェクト、ドメインルール。外部依存を持たない純粋な層。
- Application（アプリケーション）: ユースケース（UseCase）。ドメインを組み合わせて業務フローを実現する。外部実装には依存しない。
- Infrastructure（インフラ）: 永続化や外部システムとの連携の具象実装。Supabase クライアントを使用して PostgreSQL と通信する。ドメインの抽象（インターフェース）を実装する。
- Interfaces（インターフェース）: HTTP ハンドラ、ルーティング、入力検証、レスポンス整形などの外部向け入出力層。Hono フレームワークを使用。フレームワーク依存はここに閉じる。
- Shared（共通）: 全層で使われる共通型、エラークラス、ユーティリティ。

## 層の設計ポイント（契約）

簡潔な契約（インプット / アウトプット・エラー挙動）を各ユースケースに定義します。

- 入力: DTO（値のバリデーション済み）
- 出力: 明確な DTO / エンティティ／エラー型
- エラー: ドメインエラーとインフラエラーを区別し、上位層で取り扱いやすくする

これにより、UI 層やルーティング層はユースケースに対する依存のみとなり、実装の差し替えが容易になります。

## ディレクトリ（推奨）

```
src/
├── domain/
│   ├── {aggregate}/
│   │   ├── entities/
│   │   ├── valueObjects/
│   │   └── repository.ts  # Repository interface（抽象）
│   └── errors.ts
│
├── application/
│   ├── {aggregate}/
│   │   ├── dtos/
│   │   └── usecases/
│   └── services/          # 状態を持たないユースケース実装
│
├── infrastructure/
│   ├── {aggregate}RepositoryImpl.ts  # Supabase クライアントを使用した実装
│   └── utils/                         # マッピング等のユーティリティ
│
├── interfaces/
│   ├── handlers/           # ハンドラ（ユースケース呼び出し）
│   ├── routes/             # ルーティング (Hono)
│   └── server.ts           # アプリ初期化（DI 組み立て）
│
├── shared/
│   ├── types.ts            # Supabase 型定義等
│   ├── errors.ts
│   └── result.ts
│
└── test/                   # テストユーティリティ
```

## 依存注入（DI）方針

- DI コンテナを必須とはしない。ルートやアプリ初期化時に明示的に実装を注入する方式を推奨する。
- 具象（Infrastructure）はドメインの抽象（Repository interface）に依存する。ユースケースは抽象のみを参照する。
- 環境変数や設定は集中管理し、テスト時に差し替えやすい形にする。

例（概念）:

```
HTTP Request
  → Hono Router (interfaces/routes)
  → Handler (interfaces/handlers)
  → UseCase (application)
  → Repository interface (domain)
  → Repository Implementation (infrastructure)
  → Supabase Client
  → PostgreSQL
```

## テスト戦略

- Domain 層: 純粋なユニットテスト（外部依存なし）
- Application 層: ユースケース単位でモック（Repository をモック）を使う
- Interfaces 層: E2E や統合テストで実行環境に近い形で検証するが、実環境の代わりにスタブやローカルエミュレータを使えるようにする

テスト時には、インフラ実装を差し替えるだけで同じユースケースが動くことを確認できる設計が重要です。

## 運用上の注意（環境非依存）

- 構成管理: 接続情報やシークレットは環境変数やシークレットストアで管理する。
- マイグレーション: スキーマやマイグレーションはインフラ層で扱うが、SQL 等の具体表現は運用ツールに任せること。
- モニタリング: ユースケースレベルでのメトリクス（成功/失敗/遅延）を計測するためのフックを用意する。

## ベストプラクティス（要点）

1. フレームワーク依存（Hono のルーティングや HTTP 処理）は `interfaces/` に閉じる
2. Supabase クライアントや PostgreSQL の具象実装は `infrastructure/` に閉じる
3. DTO と Entity を混在させない（変換を明示する）
4. ドメインは副作用を持たない関数と状態で表現する（テスト容易性向上）
5. ルート単位で明示的な DI を行い、テスト時に簡単に置き換えられるようにする

## 実装例

### エントリーポイント (index.ts)

```typescript
import "@supabase/functions-js/edge-runtime"
import { createClient } from "@supabase/supabase-js"
import { createServer } from "./src/interfaces/server.ts"
import { Database } from "./src/shared/types.ts"

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase の接続情報が未設定です")
}

const app = createServer({
  supabaseFactory: (req) =>
    createClient<Database>(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") ?? "",
        },
      },
    }),
})

Deno.serve((req) => app.fetch(req))
```

### サーバー初期化 (interfaces/server.ts)

```typescript
import { Hono } from "@hono/hono"
import type { SupabaseClient } from "@supabase/supabase-js"
import { registerRoutes } from "./routes/index.ts"
import type { Database } from "../shared/types.ts"

type Vars = {
  supabase: SupabaseClient<Database>
}

type ServerDeps = {
  supabaseFactory: (req: Request) => SupabaseClient<Database>
}

export const createServer = (deps: ServerDeps) => {
  const app = new Hono<{ Variables: Vars }>()

  // Supabase クライアントをコンテキストに設定
  app.use("*", async (c, next) => {
    c.set("supabase", deps.supabaseFactory(c.req.raw))
    await next()
  })

  registerRoutes(app)

  return app
}
```

## まとめ

この文書は、Supabase Edge Functions 上で動作するクリーンアーキテクチャに従った設計を示しました。
実装時はこのガイドに従い、フレームワーク（Hono）や実行環境（Supabase）の詳細は `infrastructure/` と `interfaces/` に閉じることで、
ビジネスロジックを保護し、テスト容易性と保守性を高めることができます。

## 関連ドキュメント

- [Payment Modeling](./payment-modeling.md) - 支払い情報のドメインモデル詳細
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Hono Documentation](https://hono.dev/)
- [Clean Architecture (Robert C. Martin)](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)

---

必要であれば次のステップとして：

- 特定のユースケースの詳細な実装ガイドを追加
- テストの具体的なベストプラクティスを追加
- エラーハンドリングの統一的なパターンを追加
