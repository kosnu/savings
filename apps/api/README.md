# Savings API

Supabase の設定・DB マイグレーション管理を行うディレクトリです。

## セットアップ

この README 内のコマンドは、特記がない限り `apps/api/` ディレクトリで実行します。

### 前提条件

- **pnpm**: 依存関係のインストールに使用
  - インストール: リポジトリルートで `pnpm install`
- **Supabase CLI**: ローカル開発環境の管理に使用
- **Task**: タスクランナー（オプション、推奨）
  - インストール: [Task 公式サイト](https://taskfile.dev/installation/)

### ローカル Supabase の起動

```bash
# Supabase 起動
task up
# または
pnpm exec supabase start

# 停止
task down
# または
pnpm exec supabase stop
```

## データベース

### マイグレーション

データベーススキーマは `supabase/migrations/` ディレクトリで SQL マイグレーションファイルとして管理されています。

```bash
# マイグレーション適用
task up:migrations
# または
pnpm exec supabase migration up

# マイグレーション作成
pnpm exec supabase migration new <migration_name>
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
│   ├── config.toml              # Supabase の設定
│   ├── migrations/              # データベースマイグレーション
│   └── seed/                    # 初期データ
├── bin/                         # 補助スクリプト
├── Taskfile.yml                 # タスク定義
└── package.json                 # Supabase CLI 依存関係
```
