# Backend for Savings App

## Introduction

このドキュメントでは、アプリケーションのアーキテクチャについて説明します。

TypeScript + Hono + Cloudflare Workers + D1 で構成されています。

### ローカル環境

ローカル環境上でプロセスを起動し、Miniflare でエミュレートされた Cloudflare
D1 に接続して動作確認を行います。

```shell
task dev
```

### Production 環境

Production 環境では、Cloudflare Workers 上でプロセスを起動し、Cloudflare
D1 に接続して動作確認を行います。

## セットアップ

依存関係をインストールします。

```shell
npm ci
```

マイグレーションを実行します。
本来は drizzle-kit を使ってマイグレーションを実行しますが、
現状の Miniflare に対しての実行がうまくいかないため、直接 SQL ファイルを実行しています。

```shell
npx wrangler d1 execute savings-dev --config wrangler.dev.toml --file ./migrations/reset_all_tables.sql
```

## マイグレーションファイルの作成（仮）

drizzle-kit を使ってマイグレーションファイルを作成します。

```shell
npx drizzle-kit generate
```

## アーキテクチャ

クリーンアーキテクチャを採用しています。

詳細は [Architecture Document](docs/architecture.md) を参照してください。
