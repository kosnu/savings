# Copilot Instructions for Firestore Import Scripts (scripts/import_to_firestore/)

このディレクトリは **Deno** で実装された Firestore データインポート用スクリプトです。

## 重要な開発ルール

- **Deno 2.x を使用** (Node.js ではありません)
- **このディレクトリから実行**: すべてのコマンドは `scripts/import_to_firestore/` ディレクトリから実行してください
- **パーミッションフラグを明示**: Deno のセキュリティモデルに従い、必要な権限を明示的に指定してください

## クイックコマンド

```bash
# 検証コマンド（全て実行）
deno check && deno fmt --check && deno lint

# 個別実行
deno check                          # 型チェック
deno fmt --check                    # フォーマットチェック
deno fmt                            # フォーマット自動修正
deno lint                           # リント

# テスト
deno test --allow-read              # テスト実行
deno test --coverage=./coverage/    # カバレッジ付きテスト
deno coverage ./coverage/ --lcov > cov.lcov  # カバレッジレポート生成

# 実行
deno run --allow-env --allow-read main.ts --file path/to/data.csv --collection payments
```

または、リポジトリルートから Task runner 経由で実行:

```bash
task insert -- --file path/to/example.csv --collection {collection_name}
```

## 概要

CSV ファイルからデータを読み込み、Firebase Firestore にインポートするスクリプトです。

### 主な機能

- CSV ファイルの読み込み
- データ変換とバリデーション
- Firestore へのバッチ挿入
- エラーハンドリング

## 設定

### 環境変数

`.env.sample` から `.env` ファイルを作成:

```bash
cp .env.sample .env
```

必要な環境変数:

```
SERVICE_ACCOUNT_KEY_PATH=path/to/service-account-key.json
FIRESTORE_DATABASE=your-database-id
FIRESTORE_PROJECT_ID=your-project-id
SAVINGS_USER_ID=your-user-id
```

### Deno 設定

設定ファイル: `deno.json`

```json
{
  "tasks": {
    "dev": "deno run --watch main.ts"
  },
  "imports": {
    "@std/assert": "jsr:@std/assert@1",
    "@std/cli/parse-args": "jsr:@std/cli@1/parse-args",
    "@std/csv": "jsr:@std/csv@1",
    "@std/dotenv/load": "jsr:@std/dotenv@0.224.0/load"
  },
  "fmt": {
    "indentWidth": 2,
    "singleQuote": false,
    "proseWrap": "preserve",
    "semiColons": false
  },
  "lint": {
    "rules": {
      "tags": ["recommended"],
      "include": ["no-unused-vars"]
    }
  }
}
```

## プロジェクト構成

```
scripts/import_to_firestore/
  src/
    config/
      env.ts          # 環境変数読み込み (Deno.env)
      args.ts         # コマンドライン引数パース
    # その他のソースファイル
  docs/
    test_guideline.md # テストガイドライン (日本語)
  main.ts             # エントリーポイント
  deno.json           # Deno 設定
  .env.sample         # 環境変数サンプル
  .env                # 実際の環境変数 (gitignore対象)
  README.md           # ドキュメント
```

## コーディング規約

### ファイル命名規則

- TypeScript ファイル: camelCase (例: `parseData.ts`)
- テストファイル: `{対象}.test.ts` (例: `parseData.test.ts`)

### インポート規約

- Deno 標準ライブラリ: `@std/*` (deno.json の imports で定義)
- JSR パッケージ: `jsr:@scope/package@version`
- 相対パス: `./`, `../`

```typescript
// 推奨されるインポート順序
import { assertEquals } from "@std/assert"
import { parse } from "@std/csv"
import { parseArgs } from "@std/cli/parse-args"
import "@std/dotenv/load"

import { env } from "./config/env.ts"
import { yourFunction } from "./yourModule.ts"
```

### コーディングスタイル

- **セミコロン**: なし (deno.json で設定)
- **クォート**: ダブルクォート (deno.json で設定)
- **インデント**: 2 スペース

## テスト

### テストガイドライン

詳細は `docs/test_guideline.md` を参照してください。

### テストの目的

- 品質保証
- リグレッション防止
- 仕様担保

### テストの種類

- **ユニットテスト**: 個別関数のテスト
- **結合テスト**: 必要に応じて実装

### テスト実行

```bash
# 基本実行
deno test --allow-read

# カバレッジ取得
deno test --coverage=./coverage/
deno coverage ./coverage/ --lcov > cov.lcov

# HTML レポート生成 (genhtml 等を使用)
```

### テストコード記述例

```typescript
import { assertEquals } from "@std/assert"
import { yourFunc } from "./yourFunc.ts"

Deno.test("yourFunc: 正常系", () => {
  const result = yourFunc(1, 2)
  assertEquals(result, 3)
})

Deno.test("yourFunc: 異常系", () => {
  // エラーケースのテスト
})
```

### カバレッジ基準

- **目標カバレッジ**: 80%以上

### アサーションとモック

- **アサーション**: Deno 標準の `@std/assert` を使用
  - `assertEquals`, `assertExists`, `assertThrows` など
- **モック**: 外部依存がある場合は適切にモック化を検討

## パーミッションの管理

Deno はデフォルトでセキュアなため、必要な権限を明示的に指定する必要があります。

### よく使うパーミッション

- `--allow-read`: ファイル読み込み (CSV ファイル、サービスアカウントキー)
- `--allow-write`: ファイル書き込み (通常は不要)
- `--allow-env`: 環境変数アクセス (.env ファイル読み込み)
- `--allow-net`: ネットワークアクセス (Firestore API)

### 実行例

```bash
# 本番実行時
deno run --allow-env --allow-read --allow-net main.ts --file data.csv --collection payments

# テスト時
deno test --allow-read

# 開発時 (watch モード)
deno run --watch --allow-env --allow-read --allow-net main.ts --file data.csv --collection payments
```

## エラーハンドリング

### 基本方針

- 早期リターンを使用
- エラーメッセージは具体的に
- 必要に応じて適切な例外をスロー

### よくあるエラー

1. **ファイルが見つからない**: ファイルパスを確認
2. **環境変数が未設定**: `.env` ファイルを確認
3. **CSV フォーマットエラー**: CSV の列構成を確認
4. **Firestore 認証エラー**: サービスアカウントキーを確認

## データフォーマット

### CSV フォーマット要件

スクリプトが期待する CSV フォーマット:
- ヘッダー行を含む
- 文字エンコーディング: UTF-8
- 列の定義はスクリプトの仕様に従う

### Firestore ドキュメント構造

インポートされるドキュメントの構造は、CSV データとアプリケーションの要件に基づいて定義されます。

## CI/CD

### GitHub Actions

PR に対して自動実行されるチェック (`.github/workflows/scripts_ci.yaml`):

1. Deno 2.x のセットアップ
2. `deno check` (型チェック)
3. `deno fmt --check` (フォーマットチェック)
4. `deno lint` (リント)
5. `deno test --allow-read` (テスト)

### ローカルでの CI 再現

```bash
# CI と同じチェックを実行
deno check && deno fmt --check && deno lint && deno test --allow-read
```

## よくある問題と解決法

### 1. パーミッションエラー

```
error: Requires read access to "file.csv"
```

**解決**: 必要なパーミッションフラグを追加
```bash
deno run --allow-read main.ts
```

### 2. 環境変数が undefined

**解決**: `.env` ファイルが存在し、正しく設定されているか確認
```bash
cp .env.sample .env
# .env を編集
```

### 3. フォーマットエラー

```bash
# 自動修正
deno fmt

# チェックのみ
deno fmt --check
```

### 4. 型エラー

```bash
deno check  # 型チェック実行
```

## セキュリティ

### 機密情報の管理

- **サービスアカウントキー**: `.env` に記載し、`.gitignore` で除外
- **プロジェクト ID**: 環境変数で管理
- **ユーザー ID**: 環境変数で管理

### 注意事項

- `.env` ファイルは絶対にコミットしない
- サービスアカウントキーは適切に保護する
- 最小権限の原則に従ってパーミッションを設定

## パフォーマンス

### バッチ処理

- Firestore へのバッチ書き込みを使用
- 大量データの場合は適切にバッチサイズを調整

### メモリ管理

- 大きな CSV ファイルを扱う場合はストリーム処理を検討

## 今後の改善予定

- [ ] GitHub Actions での自動実行 (現在は手動)
- [ ] エラーログの強化
- [ ] バッチサイズの最適化
- [ ] プログレス表示の追加

## 関連ドキュメント

- [Deno Manual](https://deno.land/manual)
- [Deno Standard Library](https://deno.land/std)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- `docs/test_guideline.md`: テストガイドライン (日本語)
