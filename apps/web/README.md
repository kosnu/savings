# Savings - フロントエンド

このディレクトリは Savings アプリケーションのウェブフロントエンドです。
React + TypeScript + Vite を使ったシングルページアプリケーションで、認証・データベースには Supabase（Auth / PostgreSQL）を利用し、ホスティングは Cloudflare Pages を使用します。

以下は現状のコードベースに基づく簡潔な README です。ローカルでの開発、テスト、ビルド、デプロイ手順をまとめています。

## 主要技術スタック

- フレームワーク: React
- 言語: TypeScript
- ビルドツール: Vite
- テスト: Vitest + Playwright（E2E があれば）
- リンター／フォーマッタ: Biome（設定ファイルは `biome.json`）
- バックエンド（認証/DB）: Supabase（ローカル開発は Supabase CLI を使用）

## ディレクトリ構成（抜粋）

- `src/` - アプリ本体のソースコード
  - `app/` - ルーティングやページコンポーネント
  - `features/` - ドメイン別の機能（例: 収支、カテゴリ）
  - `components/` - 再利用 UI コンポーネント
  - `lib/`, `utils/` - ユーティリティ・ラッパー
- `public/` - 静的アセット
- `index.html` - Vite エントリ
- `vite.config.ts` - Vite 設定
- `biome.json` - リンター／フォーマッタ設定
- `vitest.config.ts` / `vitest.setup.ts` - テスト設定

（プロジェクトルートや monorepo 構成により一部ファイルは上位にある場合があります。ここでは `apps/web` 内の構成を想定しています。）

## 前提・注意

- Web の依存関係は必ず `apps/web/` で管理します。
- このリポジトリでは CI / デプロイやインフラ定義が `infra/` にあるため、必要に応じてルート README も参照してください。

## セットアップ（ローカル開発）

ルートではなく `apps/web/` に移動して作業してください。依存関係のインストールは必ず `npm ci` を使います。

```bash
npm ci
```

## 開発サーバー

Vite 開発サーバーを起動します。

```bash
npm run dev
```

起動後、ブラウザで表示されるローカルホストの URL にアクセスします（通常は `http://localhost:5173` 等）。

## Storybook

コンポーネントの開発には Storybook を利用しています。Storybook を起動するには：

```bash
npm run storybook -- --no-open
```

## テスト

ユニット / コンポーネントテストは Vitest で実行します。

```bash
npm test
```

E2E テストや Playwright が設定されている場合は、CI 設定や `package.json` のスクリプトを参照してください。

## Lint / 型チェック

Biome（`biome.json`）で lint / format を管理しています。実行例：

```bash
npm run check
```

型チェックは TypeScript の設定に従って `npm run build` 時や専用スクリプトで実行してください。

## Supabase ローカル開発（Auth / DB を使う場合）

ローカルで認証やデータベースを使う場合は、`apps/api/` で Supabase をローカル起動してからアプリを起動します。

```bash
# apps/api/ で Supabase + Edge Functions を起動
cd apps/api
task up

# その後、apps/web から通常通り起動
cd apps/web
npm run dev
```

## ビルド & デプロイ

プロダクション用ビルドを作成します。

```bash
cd apps/web
npm run build
```

Cloudflare Pages へデプロイする場合は、GitHub Actions (`deploy.yaml`) を参照してください。手動デプロイは Wrangler CLI を利用します。

## 環境変数

Supabase の接続情報は環境変数で管理します。主な変数は `VITE_SUPABASE_URL` と `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` です。ローカルでは `.env` / `.env.local`（Vite の仕様）を使用しますが、サンプルとして `.env.example` を用意しているか確認してください。

## 関連スクリプト・リポジトリ部分

- `apps/api/` - バックエンド API（Supabase Edge Functions、Deno + Hono）。必要に応じて API のエンドポイント形状を確認してください。
