# 開発ガイド

このドキュメントは、apps/api バックエンドの開発を行うための実践的なガイドです。

## 目次

- [環境セットアップ](#環境セットアップ)
- [開発ワークフロー](#開発ワークフロー)
- [テストの実行](#テストの実行)
- [デバッグ](#デバッグ)
- [よくある問題と解決法](#よくある問題と解決法)

## 環境セットアップ

### 1. 必要なツールのインストール

```bash
# Deno (推奨: v2.1.14)
curl -fsSL https://deno.land/install.sh | sh

# Supabase CLI (npm経由)
cd apps/api
npm ci

# Task (オプション、推奨)
# https://taskfile.dev/installation/
```

### 2. 環境変数の設定

Supabase CLI は `.env` ファイルではなく、`npx supabase start` 時に自動的に環境変数を設定します。
通常、手動での環境変数設定は不要です。

## 開発ワークフロー

### ローカル開発環境の起動

#### Task を使う場合（推奨）

```bash
cd apps/api

# Supabase と全 Edge Functions を起動
task up

# これにより以下が実行されます:
# 1. npx supabase start (Postgres, Auth 等のサービス起動)
# 2. Edge Functions のバックグラウンド起動 (payments, categories)
```

#### Supabase CLI を直接使う場合

```bash
cd apps/api

# Supabase 起動
npx supabase start

# 別ターミナルで Edge Functions を起動
npx supabase functions serve payments

# さらに別ターミナルで
npx supabase functions serve categories
```

### 起動確認

```bash
# Supabase のステータス確認
npx supabase status

# 出力例:
# API URL: http://localhost:54321
# DB URL: postgresql://postgres:postgres@localhost:54322/postgres
# Studio URL: http://localhost:54323
# ...

# Edge Functions のエンドポイント
# http://localhost:54321/functions/v1/payments
# http://localhost:54321/functions/v1/categories
```

### ログ確認

```bash
# Task を使っている場合
task logs:functions:payments
task logs:functions:categories

# または直接ログファイルを確認
tail -f apps/api/.run/function_payments.log
tail -f apps/api/.run/function_categories.log
```

### 開発サーバーの停止

```bash
# Task を使っている場合
task down

# Supabase CLI を直接使っている場合
npx supabase stop
```

## テストの実行

### 個別の Edge Function のテスト

```bash
cd apps/api/supabase/functions/payments
deno test --allow-read --allow-env

cd apps/api/supabase/functions/categories
deno test --allow-read --allow-env
```

### 特定のテストファイルの実行

```bash
cd apps/api/supabase/functions/payments
deno test src/domain/valueObjects/amount.test.ts --allow-read --allow-env
```

### テストの watch モード

```bash
cd apps/api/supabase/functions/payments
deno test --watch --allow-read --allow-env
```

### カバレッジ取得

```bash
cd apps/api/supabase/functions/payments
deno test --coverage=./coverage/ --allow-read --allow-env
deno coverage ./coverage/ --lcov > coverage.lcov
```

## データベースマイグレーション

### マイグレーションの作成

```bash
cd apps/api
npx supabase migration new <migration_name>

# 例
npx supabase migration new add_index_to_payments
```

生成されたファイル（`supabase/migrations/<timestamp>_<migration_name>.sql`）に SQL を記述します。

### マイグレーションの適用

```bash
cd apps/api

# Task を使う場合
task up:migrations

# または直接
npx supabase migration up
```

### マイグレーションのロールバック

```bash
cd apps/api

# Task を使う場合
task down:migrations

# または直接
npx supabase migration down
```

### マイグレーションの確認

```bash
# 適用済みマイグレーション一覧
npx supabase migration list
```

## シードデータ

### シードデータの投入

```bash
cd apps/api

# 既存のシードファイルを使用
bin/init_seed supabase/seed/categories.sql

# または psql を直接使用
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/seed/categories.sql
```

## コード品質チェック

### フォーマット

```bash
cd apps/api/supabase/functions/payments
deno fmt

# チェックのみ（修正しない）
deno fmt --check
```

### リント

```bash
cd apps/api/supabase/functions/payments
deno lint
```

### 型チェック

```bash
cd apps/api/supabase/functions/payments
deno check index.ts
```

## デバッグ

### Console.log デバッグ

Edge Functions 内で `console.log()` を使用すると、ログがターミナルまたはログファイルに出力されます。

```typescript
console.log("Debug info:", { userId, paymentId })
```

### Supabase Studio でのデータ確認

ブラウザで http://localhost:54323 にアクセスすると、Supabase Studio が開きます。
ここでデータベースの内容を直接確認・編集できます。

### PostgreSQL クライアントでの接続

```bash
# psql でローカル Supabase に接続
psql -h localhost -p 54322 -U postgres -d postgres
```

### Edge Functions の再起動

コードを変更した後、Edge Functions は自動的にリロードされます。
ただし、変更が反映されない場合は手動で再起動してください。

```bash
# Task を使っている場合
task down
task up

# または個別に
task stop:functions:payments
task serve:functions:payments
```

## よくある問題と解決法

### 1. Edge Functions が起動しない

**症状**: `task up` や `npx supabase functions serve` がエラーで終了する

**原因と解決法**:

- Supabase が起動していない → `npx supabase start` を実行
- ポートが既に使用されている → `npx supabase stop` してから再起動
- Deno のバージョンが古い → Deno v2.1.14 にアップグレード

### 2. データベース接続エラー

**症状**: Edge Functions から DB に接続できない

**解決法**:

```bash
# Supabase のステータス確認
npx supabase status

# Supabase の再起動
npx supabase stop
npx supabase start
```

### 3. テストが失敗する

**症状**: `deno test` がエラーで失敗する

**原因と解決法**:

- 必要なパーミッションフラグが足りない → `--allow-read --allow-env` を追加
- モックが正しく設定されていない → テストコードを確認
- 型定義が古い → `deno cache --reload` でキャッシュをクリア

### 4. 型エラーが出る

**症状**: TypeScript の型エラーが表示される

**解決法**:

```bash
# キャッシュのクリア
deno cache --reload index.ts

# 型チェック実行
deno check index.ts
```

### 5. マイグレーションが適用されない

**症状**: マイグレーションファイルを作成したが DB に反映されない

**解決法**:

```bash
# マイグレーションの適用
task up:migrations

# 適用状態の確認
npx supabase migration list
```

### 6. `.run` ディレクトリのログやPIDファイルが残る

**症状**: `task down` 後も `.run` ディレクトリにファイルが残る

**解決法**:

```bash
# 手動でクリーンアップ
rm -rf apps/api/.run

# プロセスが残っている場合は kill
ps aux | grep "supabase functions serve"
kill <PID>
```

## ディレクトリの git 管理

`.run` ディレクトリは `.gitignore` に含まれており、Git で追跡されません。

## 新しい Edge Function の追加

1. 関数ディレクトリの作成

```bash
mkdir -p apps/api/supabase/functions/new-function
```

2. 必要なファイルの作成

```bash
# index.ts, deno.json を作成
# categories や payments を参考にする
```

3. `config.toml` に設定追加

```toml
[functions.new-function]
enabled = true
verify_jwt = true
import_map = "./functions/new-function/deno.json"
entrypoint = "./functions/new-function/index.ts"
```

4. `Taskfile.yml` にタスク追加（オプション）

```yaml
serve:functions:new-function:
  desc: Serve new-function in background
  cmds:
    - mkdir -p .run
    - sh -c 'nohup npx supabase functions serve new-function > .run/function_new-function.log 2>&1 & echo $! > .run/function_new-function.pid'
```

## 参考リンク

- [Supabase CLI リファレンス](https://supabase.com/docs/guides/cli)
- [Deno マニュアル](https://deno.land/manual)
- [Hono ドキュメント](https://hono.dev/)
- [Architecture Overview](./architecture.md)
- [Payment Modeling](./payment-modeling.md)
- [Category Modeling](./category-modeling.md)
