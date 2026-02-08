# Savings APIs

バックエンドの API は [Supabase Edge Functions](https://supabase.com/docs/guides/functions) を使用して構築されています。
これらの関数は、`apps/api/supabase/functions/` ディレクトリにあります。

## セットアップ

### 前提条件

- **Deno**: Supabase Edge Functions は Deno ランタイムで動作します
  - インストール: [公式ガイド](https://docs.deno.com/runtime/getting_started/installation/)
  - 推奨バージョン: `v2.1.14` (Supabase Edge Functions との互換性のため)
- **Supabase CLI**: ローカル開発環境の管理に使用
  - インストール: `npm ci` (このディレクトリで実行)
- **Task**: タスクランナー（オプション、推奨）
  - インストール: [Task 公式サイト](https://taskfile.dev/installation/)

### ローカル開発環境の起動

#### Task を使う場合（推奨）

```bash
# Supabase と全 Edge Functions を起動
task up

# 停止
task down

# マイグレーション適用
task up:migrations

# ログ確認
task logs:functions:payments
task logs:functions:categories
```

#### Supabase CLI を直接使う場合

```bash
# Supabase 起動
npx supabase start

# 関数のサーブ（別ターミナルで）
npx supabase functions serve payments
npx supabase functions serve categories

# 停止
npx supabase stop
```

## 利用可能な関数

### payments

支払い情報の管理API

- エンドポイント: `/payments`
- 機能: 支払いの検索、取得、作成、更新、削除
- クリーンアーキテクチャを採用
- 詳細: [Payment Modeling](./docs/payment-modeling.md)

### categories

カテゴリ管理API

- エンドポイント: `/categories`
- 機能: カテゴリの取得、管理
- クリーンアーキテクチャを採用
- 詳細: [Category Modeling](./docs/category-modeling.md)

## アーキテクチャ

各関数は、HTTP リクエストを受け取り、JSON レスポンスを返すエンドポイントです。
関数は TypeScript で記述されており、以下の技術スタックを使用しています：

- **ランタイム**: Deno 2.x
- **HTTP フレームワーク**: Hono
- **BaaS**: Supabase (Edge Functions, Postgres, Auth JWT 検証)
- **クライアント SDK**: `@supabase/supabase-js@2.x`
- **アーキテクチャパターン**: クリーンアーキテクチャ

詳細なアーキテクチャについては、[Architecture Overview](./docs/architecture.md) を参照してください。

## 開発を始める

詳細な開発手順については、[開発ガイド](./docs/development-guide.md) を参照してください。

## テスト

各関数には Deno のテストフレームワークを使用したテストが含まれています。

```bash
# payments のテスト実行
cd supabase/functions/payments
deno test --allow-read --allow-env

# categories のテスト実行
cd supabase/functions/categories
deno test --allow-read --allow-env
```

## データベース

### マイグレーション

データベーススキーマは `supabase/migrations/` ディレクトリで SQL マイグレーションファイルとして管理されています。

```bash
# マイグレーション適用
task up:migrations
# または
npx supabase migration up

# マイグレーション作成
npx supabase migration new <migration_name>
```

### シード

初期データは `supabase/seed/` ディレクトリにあります。

```bash
# シードデータ投入（例）
bin/init_seed supabase/seed/categories.sql
```

## ディレクトリ構成

```
apps/api/
├── supabase/
│   ├── config.toml              # Edge Functions の設定
│   ├── functions/
│   │   ├── import_map.json      # 共有インポートマップ
│   │   ├── payments/            # 支払い管理 API
│   │   │   ├── index.ts         # エントリーポイント
│   │   │   ├── deno.json        # Deno 設定
│   │   │   └── src/             # ソースコード (クリーンアーキテクチャ)
│   │   └── categories/          # カテゴリ管理 API
│   │       ├── index.ts         # エントリーポイント
│   │       ├── deno.json        # Deno 設定
│   │       └── src/             # ソースコード (クリーンアーキテクチャ)
│   ├── migrations/              # データベースマイグレーション
│   └── seed/                    # 初期データ
├── bin/                         # 補助スクリプト
├── docs/                        # ドキュメント
├── Taskfile.yml                 # タスク定義
└── package.json                 # Supabase CLI 依存関係
```

## 開発ガイドライン

詳細な開発ルールについては、以下を参照してください：

- [開発ガイド](./docs/development-guide.md) - 環境セットアップ、開発ワークフロー、よくある問題
- [Architecture Overview](./docs/architecture.md) - アーキテクチャの設計指針
- [Copilot Instructions](../.github/instructions/apps-api.instructions.md) - AI 開発支援向けの詳細ルール

主なポイント：

- **コーディングスタイル**: Deno の標準スタイル (`deno fmt`, `deno lint`)
- **アーキテクチャ**: クリーンアーキテクチャ（domain/application/infrastructure/interfaces 層の分離）
- **テスト**: 各層でのユニットテスト、統合テスト
- **認証**: JWT 検証 (`verify_jwt = true`)

## 参考リンク

- [Supabase Edge Functions ドキュメント](https://supabase.com/docs/guides/functions)
- [Deno マニュアル](https://deno.land/manual)
- [Hono ドキュメント](https://hono.dev/)
