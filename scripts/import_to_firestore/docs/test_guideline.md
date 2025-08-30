# テストガイドライン

## 1. テストの目的・方針

品質保証、リグレッション防止、仕様担保のためにテストを実施します。

## 2. テストの種類

- ユニットテスト
- 結合テスト（必要に応じて）

## 3. テストファイルの命名規則

- `{対象}.test.ts` の形式で作成してください。

## 4. テスト実行方法

- 基本コマンド: `deno test --allow-read`
- カバレッジ取得: `deno test --coverage=./coverage/`
- カバレッジレポート生成例:
  ```sh
  deno test --coverage=./coverage/
  deno coverage ./coverage/ --lcov > cov.lcov
  # lcovレポートをHTML化する場合はgenhtml等を利用する
  ```

## 5. アサーション・モックの使い方

- アサーションには `assertEquals` など Deno 標準のassertを利用する
- 外部依存がある場合はモック化を検討する

## 6. カバレッジ基準

- 目標カバレッジ: 80%以上

## 7. CI/CD連携

現状は手動実行ですが、将来的にGitHub Actions等で自動化を検討している。

## 8. テストコードの記述例

```ts
import { assertEquals } from "https://deno.land/std@0.203.0/assert/mod.ts"
import { yourFunc } from "./yourFunc.ts"

Deno.test("yourFunc: 正常系", () => {
  const result = yourFunc(1, 2)
  assertEquals(result, 3)
})
```
