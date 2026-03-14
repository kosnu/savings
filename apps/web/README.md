# Savings - フロントエンド

このディレクトリは Savings アプリケーションのウェブフロントエンドです。
React + TypeScript + Vite を使ったシングルページアプリケーションで、認証・データベースには Supabase（Auth / PostgreSQL）を利用し、ホスティングは Cloudflare Pages を使用します。

以下は現状のコードベースに基づく簡潔な README です。ローカルでの開発、テスト、ビルド、デプロイ手順をまとめています。

## 主要技術スタック

- フレームワーク: React
- 言語: TypeScript
- ビルドツール: Vite
- テスト: Vitest + Playwright（E2E があれば）
- リンター: Oxc Oxlint（設定ファイルは `.oxlintrc.json`）
- フォーマッタ: Oxc Oxfmt（設定ファイルは `.oxfmtrc.json`）
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
- `.oxlintrc.json` - リンター設定
- `.oxfmtrc.json` - フォーマッタ設定
- `vitest.config.ts` / `vitest.setup.ts` - テスト設定

（プロジェクトルートや monorepo 構成により一部ファイルは上位にある場合があります。ここでは `apps/web` 内の構成を想定しています。）

## 前提・注意

- Web は `pnpm workspace` 配下のパッケージです。
- この README 内のコマンドは、特記がない限り `apps/web/` ディレクトリで実行します。
- CI やデプロイの全体像が必要な場合は、必要に応じてルート README や `docs/` 配下の文書も参照してください。

## セットアップ（ローカル開発）

依存関係のインストールだけはリポジトリルートで `pnpm install` を実行します。

```bash
pnpm install
```

## 開発サーバー

Vite 開発サーバーを起動します。

```bash
task dev
```

起動後、ブラウザで表示されるローカルホストの URL にアクセスします（通常は `http://localhost:5173` 等）。

## Storybook

コンポーネントの開発には Storybook を利用しています。Storybook を起動するには：

```bash
task storybook -- --no-open
```

## テスト

ユニット / コンポーネントテストは Vitest で実行します。

```bash
task test
```

E2E テストや Playwright が設定されている場合は、CI 設定や `package.json` のスクリプトを参照してください。

## Lint / 型チェック

Oxc（`oxlint` / `oxfmt`）で lint / format を管理しています。実行例：

```bash
task check
pnpm lint
pnpm format
```

型チェックは TypeScript の設定に従って `pnpm build` 時や専用スクリプトで実行してください。

## Supabase ローカル開発（Auth / DB を使う場合）

ローカルで認証やデータベースを使う場合は、`apps/api/` で Supabase をローカル起動してからアプリを起動します。

```bash
# apps/api/ で Supabase を起動
cd ../api
task up

# その後、apps/web から通常通り起動
cd ../web
task dev
```

## ビルド & デプロイ

プロダクション用ビルドを作成します。

```bash
task build
```

Cloudflare Pages へデプロイする場合は、GitHub Actions (`deploy.yaml`) を参照してください。手動デプロイは Wrangler CLI を利用します。

## 環境変数

Supabase の接続情報は環境変数で管理します。主な変数は `VITE_SUPABASE_URL` と `VITE_SUPABASE_PUBLISHABLE_KEY` です。ローカルでは `.env` / `.env.local`（Vite の仕様）を使用し、サンプルは `apps/web/.env.sample` を参照します。

Sentry を使う場合は、フロントエンド実行時に次の変数を設定します。

- `VITE_SENTRY_DSN` - ブラウザ SDK がエラー送信に使う DSN。本番でのみ利用され、未設定なら初期化しません。
- `VITE_SENTRY_ENVIRONMENT` - Sentry 上での environment 名。未設定時は `production` / `development` / `test` の Vite mode を使います。

source map をアップロードするデプロイ環境では、GitHub Actions の secrets として次も必要です。

- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

## 関連スクリプト・リポジトリ部分

- `apps/api/` - Supabase の設定・DB マイグレーション管理。
