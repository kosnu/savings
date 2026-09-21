# Burneto

Burneto は、予算と日々の支出を見比べ、使えるお金を確認できる家計簿アプリケーションです。

## 機能

- 支払いの記録と月別の確認
- カテゴリ別の支出集計
- 月予算とカテゴリ予算の管理
- ダークモードのサポート
- 日本語・英語のサポート
- モバイルおよびデスクトップ向けのレスポンシブデザイン

## 構成

- [フロントエンド](apps/web/README.md)
- [バックエンド](apps/api/README.md)

プロダクト名は Burneto ですが、リポジトリ名は `kosnu/savings` を維持しています。

## 開発環境

開発ツールのバージョン管理には [mise](https://mise.jdx.dev/) を使用します。mise をインストールしてシェル連携を有効にした後、この README があるリポジトリルートで次を実行します。

```shell
mise install
pnpm install
```

`mise.toml` は、AIDD Checker の `go.mod` および CI と同期した標準Go環境と、既存の `package.json` および CI と同じ Node.js / pnpm バージョンを指定します。AIDD Checkerは`go.mod`を満たすtoolchainで実行し、追加のGo minor系列制限は設けません。バージョン更新時は、Go は AIDD Checker の `go.mod` および CI、Node.js / pnpm は `package.json` および CI と指定を揃えてください。Supabase CLI、Wrangler、Vite などのプロジェクト固有ツールは、引き続き `package.json` と `pnpm-lock.yaml` で管理します。

このリポジトリは `pnpm workspace` を使用します。依存関係のインストールはリポジトリルートで実行します。

各アプリの操作は pnpm workspace scripts から実行します。変更時の検証ルールは `AGENTS.md` の Verification を参照します。
