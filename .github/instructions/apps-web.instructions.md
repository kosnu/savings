# Copilot Instructions for Web Frontend (apps/web/)

このディレクトリは **React 19 + TypeScript + Vite** によるフロントエンドアプリケーションです。

## 重要な開発ルール

- **Biome を使用** (ESLint ではありません): `npm run check` でリント、`npm run check-write` で自動修正
- **npm ci を常に使用** (`npm install` ではなく)
- **このディレクトリから実行**: すべてのコマンドは `apps/web/` ディレクトリから実行してください

## クイックコマンド

```bash
npm ci                              # 依存関係インストール (ALWAYS use ci)
npm run check                       # Biome リント
npm run check-write                 # Biome 自動修正
npm run build                       # プロダクションビルド (tsc + vite)
npm run test                        # テスト実行 (Emulator必要)
npm run test-watch                  # Watch モードでテスト
npm run storybook                   # Storybook 起動 (http://localhost:6006)
npm run plop                        # コンポーネント生成
```

## アーキテクチャ

### ディレクトリ構成

```
src/
  app/              # ルーティング、Layout、Header、Sidebar
  components/       # 再利用可能なUIコンポーネント
  features/         # 機能別モジュール (payments/, summaryByMonth/)
  providers/        # Contextプロバイダー (Theme, Snackbar, Firebase)
  lib/              # 外部ライブラリのラッパー
  utils/            # ユーティリティ関数
  types/            # 型定義
  config/           # 設定
  test/             # テストユーティリティ
  assets/           # 静的アセット
  main.tsx          # エントリーポイント
```

### 主要なライブラリ

- **UI**: @radix-ui/themes
- **状態管理**: @tanstack/react-query
- **ルーティング**: react-router-dom
- **バリデーション**: zod
- **バックエンド**: Firebase (Auth, Firestore)
- **日付**: date-fns
- **テスト**: Vitest, @testing-library/react, Playwright
- **ストーリー**: Storybook

## コーディング規約

### コンポーネント作成

**新しいコンポーネントは `npm run plop` で生成してください**:
- `.tsx` (コンポーネント本体)
- `.stories.tsx` (Storybook ストーリー)
- `.test.tsx` (テスト)
- `index.ts` (エクスポート)

### ファイル命名規則

- コンポーネント: PascalCase (例: `PaymentForm.tsx`)
- ユーティリティ: camelCase (例: `formatDate.ts`)
- テスト: `*.test.ts(x)`
- ストーリー: `*.stories.tsx`

### インポート順序

1. 外部ライブラリ
2. 内部モジュール (@/からの絶対パス)
3. 相対パス
4. 型定義
5. スタイル

## テスト

### テスト実行の前提条件

1. **Firebase Emulator を起動**: リポジトリルートで `docker compose up -d`
2. **Playwright をインストール**: `npx playwright install --with-deps chromium`

### テストの種類

- **Unit/Integration tests**: `*.test.ts(x)` (174ファイル)
- **Visual tests**: `*.stories.tsx` (32ストーリー)
- **カバレッジ目標**: 80%以上

### テスト設定

- 設定ファイル: `vitest.config.ts`
- セットアップ: `vitest.setup.ts`
- 環境変数: `vitest.config.ts` にハードコード (TODO: .env.test から読み取り)

```typescript
// テスト用環境変数 (vitest.config.ts)
VITE_FIREBASE_PROJECT_ID: "savings-test"
VITE_FIRESTORE_EMULATOR_HOST: "localhost:8080"
VITE_FIREBASE_AUTH_DOMAIN: "http://localhost:9099"
VITE_FIRESTORE_DATABASE_ID: "savings-test"
```

## ビルドと最適化

### ビルド設定

- **設定ファイル**: `vite.config.ts`
- **TypeScript 設定**: `tsconfig.json`, `tsconfig.app.json`
- **ビルド時間**: 約5-10秒
- **出力**: `apps/web/dist/`

### バンドル最適化

`vite.config.ts` でマニュアルチャンク分割:
- `vendor-firebase`: Firebase関連
- `vendor-radix`: Radix UI関連
- `vendor`: その他のnode_modules

⚠️ 500KB以上のチャンクについて警告が出ますが、これは想定内です。

## Storybook

### 起動と利用

```bash
npm run storybook         # 開発サーバー起動 (port 6006)
npm run build-storybook   # 静的ビルド
```

### ストーリー作成

```typescript
import type { Meta, StoryObj } from "@storybook/react"
import { YourComponent } from "./YourComponent"

const meta = {
  title: "Path/To/Component",
  component: YourComponent,
  tags: ["autodocs"],
} satisfies Meta<typeof YourComponent>

export default meta
type Story = StoryObj<typeof YourComponent>

export const Default: Story = {
  args: {
    // props
  },
}
```

### Storybook 設定

- **設定**: `.storybook/main.ts`
- **Addons**: onboarding, chromatic, mock-date, vitest, docs
- **環境変数**: `.storybook/main.ts` にハードコード

## よくある問題と解決法

### 1. Biome エラー

```bash
npm run check-write  # 自動修正
```

### 2. TypeScript エラー

```bash
tsc -b  # 型チェック
```

### 3. テストが失敗する

- Firebase Emulator が起動しているか確認: `docker compose up -d` (リポジトリルート)
- Emulator ポート: 8080 (Firestore), 9099 (Auth), 4000 (UI)
- Docker イメージのビルドに失敗する場合はスキップ可能

### 4. Playwright が見つからない

```bash
npx playwright install --with-deps chromium
```

### 5. Node バージョン警告

Node 20.x で "Unsupported engine" 警告が出ますが動作します。可能であれば 24.9.0 を推奨。

## 開発ワークフロー

1. **変更取得後**: `npm ci` を実行
2. **コミット前**:
   - `npm run check` (Biome リント)
   - `npm run test` (Emulator 起動時)
   - `npm run build` (ビルド確認)
3. **新規コンポーネント**: `npm run plop` を使用

## 既知の TODO

- [ ] `.env.test` からテスト環境変数を読み取る (現在は `vitest.config.ts` にハードコード)
- [ ] Storybook における FirestoreTestProvider の重複を解消 (複数ファイルに FIXME コメントあり)

## Feature 構成

### payments/

支払い (Payment) 機能:
- CRUD 操作
- フォーム (PaymentForm)
- 一覧表示 (PaymentList)
- 詳細表示

### summaryByMonth/

月次サマリー機能:
- 月別集計レポート
- グラフ表示
- フィルタリング

## Context Providers

- **ThemeProvider**: テーマ管理 (Radix UI Themes)
- **SnackbarProvider**: 通知表示
- **FirebaseProvider**: Firebase 初期化と認証

## バリデーション規則

- **Zod を使用** してスキーマ定義
- フォームバリデーションは React Hook Form と組み合わせて使用
- API レスポンスのバリデーションも Zod で実施

## パフォーマンスに関する注意

- React Query でデータフェッチングをキャッシュ
- コンポーネントの遅延読み込みには React.lazy を使用
- 大きなリストは仮想化を検討

## セキュリティ

- Firebase ルールでアクセス制御
- 機密情報 (API キー等) は環境変数で管理
- `.env` ファイルはコミット禁止
