# Savings API

Supabase の設定・DB マイグレーション管理を行うディレクトリです。

## セットアップ

### 前提条件

- **Supabase CLI**: ローカル開発環境の管理に使用
  - インストール: `npm ci` (このディレクトリで実行)
- **Task**: タスクランナー（オプション、推奨）
  - インストール: [Task 公式サイト](https://taskfile.dev/installation/)

### ローカル Supabase の起動

```bash
# Supabase 起動
task up
# または
npx supabase start

# 停止
task down
# または
npx supabase stop
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
│   ├── config.toml              # Supabase の設定
│   ├── migrations/              # データベースマイグレーション
│   └── seed/                    # 初期データ
├── bin/                         # 補助スクリプト
├── Taskfile.yml                 # タスク定義
└── package.json                 # Supabase CLI 依存関係
```
