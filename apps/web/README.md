# Savings - フロントエンド

このディレクトリは Savings アプリケーションのウェブフロントエンドです。
React + TypeScript + Vite を使ったシングルページアプリケーションで、認証・データ保存には Firebase（Auth / Firestore / Hosting）を利用します。

以下は現状のコードベースに基づく簡潔な README です。ローカルでの開発、テスト、ビルド、デプロイ手順をまとめています。

## 主要技術スタック

- フレームワーク: React
- 言語: TypeScript
- ビルドツール: Vite
- テスト: Vitest + Playwright（E2E があれば）
- リンター／フォーマッタ: Biome（設定ファイルは `biome.json`）
- バックエンド（認証/DB/ホスティング）: Firebase（Emulator を使ったローカル開発を想定）

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
- このリポジトリでは CI / デプロイやスクリプトが他のフォルダ（`scripts/import_to_firestore/` や `infra/`）にあるため、必要に応じてルート README も参照してください。

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

Biom e（`biome.json`）で lint / format を管理しています。実行例：

```bash
npm run check
```

型チェックは TypeScript の設定に従って `npm run build` 時や専用スクリプトで実行してください。

## Firebase Emulator（ローカルで Auth / Firestore を使う場合）

リポジトリには Docker を使った Firebase Emulator の設定が含まれています（`docker/firebase/`、`compose.yml`）。エミュレータを使う場合はルートから docker compose を起動してください。

```bash
# ルートで
docker compose up -d

# その後、apps/web から通常通り起動
cd apps/web
npm run dev
```

エミュレータがない環境では一部のテストや E2E がスキップされることがあります（CI ワークフロー参照）。

## ビルド & デプロイ

プロダクション用ビルドを作成します。

```bash
cd apps/web
npm run build
```

Firebase Hosting へデプロイする場合は、ルートや `apps/web` の README / GitHub Actions (`deploy_web.yaml`) を参照してください。手動デプロイ手順は Firebase CLI を利用します。

## 環境変数

Firebase の設定など機密情報は環境変数や Secrets で管理してください。ローカルでは `.env` / `.env.local`（Vite の仕様）を使用しますが、サンプルとして `.env.example` を用意しているか確認してください。

## 関連スクリプト・リポジトリ部分

- `scripts/import_to_firestore/` - Deno スクリプトで CSV を Firestore に取り込むユーティリティ。データ移行や初期インポート時に参照します。
- `apps/api/` - バックエンド（Workers / Drizzle / DB）実装。必要に応じて API のエンドポイント形状を確認してください。
