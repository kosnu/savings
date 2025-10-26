# Savings APIs

バックエンドの API は [Supabase Edge Functions](https://supabase.com/docs/guides/functions) を使用して構築されています。
これらの関数は、`apps/api/functions` ディレクトリにあります。

## セットアップ

## アーキテクチャ

各関数は、HTTP リクエストを受け取り、JSON レスポンスを返すシンプルなエンドポイントです。
関数は TypeScript で記述されており、Supabase クライアントを使用してデータベースと対話します。

詳細なドキュメントについては、[Architecture Overview for TypeScript + Hono Backend](./docs/architecture.md) を参照してください。
