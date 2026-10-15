# Burneto - フロントエンド

このディレクトリは Burneto アプリケーションのウェブフロントエンドです。
React + TypeScript + Vite を使ったシングルページアプリケーションで、認証・データベースには Supabase（Auth / PostgreSQL）を利用します。配信設定は Cloudflare Workers Static Assets です。本番の Pages からの切替は、[移管手順](../../docs/workers-migration.md)に従い承認後に実施します。

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
pnpm dev
```

起動後、ブラウザで表示されるローカルホストの URL にアクセスします（通常は `http://localhost:5173` 等）。

## Storybook

コンポーネントの開発には Storybook を利用しています。Storybook を起動するには：

```bash
pnpm storybook --no-open
```

## テスト

ユニット / コンポーネントテストは Vitest で実行します。

E2E テストや Playwright が設定されている場合は、CI 設定や `package.json` のスクリプトを参照してください。

## Lint / 型チェック

Oxc（`oxlint` / `oxfmt`）で lint / format を管理しています。実行例：

```bash
pnpm lint
pnpm format
pnpm format --check
pnpm typecheck
```

変更時の検証ルールは、リポジトリルートの `AGENTS.md` にある Verification を参照してください。

型チェックは `pnpm typecheck` で明示的に実行できます。`pnpm build` でも `tsc -b` を通るため、ビルド時にも型チェックされます。
`pnpm typecheck` を直接実行しても同じチェックが走ります。

## Supabase ローカル開発（Auth / DB を使う場合）

ローカルで認証やデータベースを使う場合は、`apps/api/` で Supabase をローカル起動してからアプリを起動します。

```bash
# apps/api/ で Supabase を起動
cd ../api
pnpm start

# その後、apps/web から通常通り起動
cd ../web
pnpm dev
```

## ビルド & デプロイ

プロダクション用ビルドを作成します。

```bash
pnpm build
```

Cloudflare Vite plugin が `.cloudflare/output/v0/` に Workers Static Assets の配信物を作成します。
`cloudflare.config.ts` が Worker 名 `burneto`、本番ドメイン `burneto.com`、SPA fallback を定義します。
Worker のサーバーコードは追加しません。通常の `pnpm dev` は既存の Vite 開発サーバーを使います。

ビルド後は、認証情報を使わずに cf で配信物を検証できます。

```bash
pnpm exec cf deploy --prebuilt --mode production --dry-run
pnpm preview --host 127.0.0.1
```

本番配信は GitHub Actions の [Deploy Production](../../.github/workflows/deploy_production.yaml) を手動実行します。
cf は再ビルドせず、検証した同じ配信物を `--prebuilt --mode production` でデプロイします。
初回の本番切替、必要な token 権限、動作確認と切り戻しは[移管手順](../../docs/workers-migration.md)を参照してください。
本番切替と旧 Pages 削除には、具体的な実施内容への承認が必要です。

## 環境変数

Supabase の接続情報は環境変数で管理します。主な変数は `VITE_SUPABASE_URL` と `VITE_SUPABASE_PUBLISHABLE_KEY` です。ローカルでは `.env` / `.env.local`（Vite の仕様）を使用し、サンプルは `apps/web/.env.sample` を参照します。

Sentry の設定は GitHub Actions の `production` / `development` Environment それぞれの同名 Secrets からビルドへ渡します。production の Secrets は development に継承されません。両配信 workflow は次の5項目のいずれかが空ならビルド前に停止します。

- `VITE_SENTRY_DSN` - 対象 Sentry project のエラー送信用 DSN。配信用ビルドでブラウザ SDK が利用します。
- `VITE_SENTRY_ENVIRONMENT` - Sentry 上の環境名。本番は `production`、Dev Preview は `development` を登録します。
- `SENTRY_AUTH_TOKEN` - source map アップロード用の認証 token。
- `SENTRY_ORG` - 対象組織の slug。
- `SENTRY_PROJECT` - DSN と同じ対象 project の slug。

`VITE_` の2項目はビルド時にブラウザ向け成果物へ埋め込みます。管理 token は `VITE_` 変数にしません。
本番・Dev Preview とも配信用 build で同じ Sentry plugin を使い、hidden source map を生成して `.cloudflare/output/v0/workers/default/assets/` からアップロードし、公開物の JS/CSS map を削除します。通常の local 開発サーバーでは SDK・plugin とも無効です。

収集情報・受信確認は [Sentry の運用](../../docs/sentry-monitoring.md)、Dev の設定・配信手順は [Dev Preview](../../docs/development-preview.md)を参照してください。

## 関連スクリプト・リポジトリ部分

- `apps/api/` - Supabase の設定・DB マイグレーション管理。
