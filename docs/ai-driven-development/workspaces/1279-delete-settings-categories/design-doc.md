# Design Doc: 設定画面でカテゴリを削除できるようにする

## 概要

Requirements / PRD: `docs/ai-driven-development/workspaces/1279-delete-settings-categories/requirements.md`

設定画面のカテゴリ一覧に削除操作を追加し、同期削除でカテゴリを削除できるようにする。支払いで使われているカテゴリも事前チェックなしで削除し、削除後は支払い自体を残したまま、支払い情報から削除済みカテゴリ情報を参照できない状態にする。

実装は既存の Supabase 直接操作、React Query の invalidate、Radix Themes の Dialog パターンに合わせる。新規依存は追加しない。

## 採用する実装方針

### DB / RLS

- 新規 migration を追加し、`categories` に delete policy を追加する。
  - policy 名: `Users can delete member book categories`
  - 対象: `categories for delete to authenticated`
  - 条件: `categories.book_id` に対して、現在の認証ユーザーが `book_members` に存在すること。
- `payments.category_id` の FK は既存定義の `on delete set null` を利用する。
  - PRD は null 化を要求として固定していないが、現行DB契約にすでにある参照解除方式を採用する。
  - これにより、削除後も支払い行は残り、カテゴリ JOIN 結果は `null` になる。
- カテゴリ削除時の参照行更新・削除を支える index を追加する。
  - `payments(category_id)` に index を追加する。既存の `idx_payments_book_date_category_created` は `category_id` が先頭ではないため、FK の削除時参照確認には不十分。
  - `category_pins(category_id)` に index を追加する。`category_pins` は `on delete cascade` なので、カテゴリ削除時にピンが残らないことを支える。
- `category_budgets` は削除済み機能なので、新規対応しない。
- `database.types.ts` は policy / index 追加だけなら更新不要。生成結果に差分が出た場合のみ同期する。

### Web: 削除 API と mutation

- `apps/web/src/features/categories/deleteCategory/` を追加する。
  - `deleteCategory.ts`: `supabase.from("categories").delete().eq("id", categoryId).select("id").single()` で削除し、削除対象がなければエラーにする。
  - `useDeleteCategory.ts`: delete mutation を提供する。
  - `DeleteCategoryModal/`: 既存 `DeletePaymentModal` と同じ Dialog ベースの確認UIにする。
- mutation 成功時は次の query を invalidate する。
  - `invalidateCategoryQueries(queryClient)`
  - `paymentQueryKeys.all`
  - `paymentQueryKeys.detailsAll`
  - `summaryQueryKeys.categoryTotalsAll`
- mutation 失敗時は snackbar で失敗を通知し、確認ダイアログを閉じない。
- 削除成功時は snackbar で成功を通知し、確認ダイアログを閉じる。

### Web: 設定画面 UI

- `CategorySettingsList` の各行アクションに削除ボタンを追加する。
  - 既存の `Edit` と同じ `CategoryActionsCell` 内に配置する。
  - mobile / desktop の既存二重配置に合わせ、削除操作も両方で表示されるようにする。
- 削除ボタンは `TrashIcon` を使い、`Delete <category name> category` 相当の aria-label を付ける。
- 確認ダイアログの内容は最小限にする。
  - title: `Delete this category?`
  - description: `<category name>` と「Payments keep their records, but this category will no longer be available.」相当の説明。
  - confirm button: `Delete`
  - cancel button: 既存 `CancelButton`
- 支払いで使われているかどうかの事前チェック、影響件数表示、削除前警告は追加しない。

### Web: 支払い側の扱い

- 支払い一覧・詳細取得は既存どおりカテゴリ JOIN を使う。
- カテゴリ削除後は `payments.category_id` が参照解除され、JOIN 結果が `null` になるため、既存の `unknownCategory` 表示経路で扱う。
- 支払い作成・更新・カテゴリフィルタの選択肢は `categories` 一覧に依存しているため、カテゴリ query invalidate により削除済みカテゴリを表示しない。
- URL search に削除済みカテゴリIDが残った場合は、既存の `PaymentCategoryFilter` の `Unknown category` 表示と空結果 + `Clear filter` 導線を維持する。自動で search を消す変更はしない。

## 変更対象

- DB:
  - `apps/api/supabase/migrations/<timestamp>_add_category_delete_policy.sql`
- Web:
  - `apps/web/src/features/categories/deleteCategory/deleteCategory.ts`
  - `apps/web/src/features/categories/deleteCategory/useDeleteCategory.ts`
  - `apps/web/src/features/categories/deleteCategory/DeleteCategoryModal/`
  - `apps/web/src/features/categories/components/CategorySettingsList/CategorySettingsList.tsx`
  - `apps/web/src/test/msw/handlers/categorySettings.ts`
- Tests:
  - `apps/web/src/features/categories/deleteCategory/deleteCategory.test.ts`
  - `apps/web/src/features/categories/deleteCategory/useDeleteCategory.test.tsx`
  - `apps/web/src/features/categories/deleteCategory/DeleteCategoryModal/DeleteCategoryModal.test.tsx`
  - `apps/web/src/features/categories/components/CategorySettingsList/CategorySettingsList.test.tsx`
  - 既存の支払い取得・カテゴリフィルタテストは必要なケースだけ追加する。

コンポーネント追加は `apps/web/docs/policies/component-structure.md` に従い、単体 `DeleteCategoryModal.tsx` は作らず、`DeleteCategoryModal/DeleteCategoryModal.tsx` と `DeleteCategoryModal/index.ts` を置く。

## 採用しない案

- 事前に支払い利用有無を確認して削除をブロックする案は採用しない。PRD の対象外であり、事前チェックなしで削除できることが成功条件。
- 支払いを削除する案は採用しない。支払い履歴の欠落は Stop 条件。
- 削除済みカテゴリの名前を支払い側に保持して表示する案は採用しない。削除済みカテゴリ情報を有効なカテゴリ情報として参照できないことに反する。
- 非同期削除ジョブは採用しない。初期実装は同期削除で、将来拡張余地だけを残す。
- 削除対象カテゴリを `archived` や `deleted_at` で論理削除する案は採用しない。現行スキーマにない状態管理を増やし、カテゴリ一覧・選択肢・集計の除外条件が広がるため初期スコープに対して過大。

## 既存挙動への影響

- カテゴリ作成・名前変更は既存のまま維持する。
- 削除後、カテゴリ一覧・支払いカテゴリ選択肢・カテゴリフィルタから対象カテゴリは消える。
- 削除対象カテゴリに紐づく `category_pins` は FK cascade により削除される。
- 削除対象カテゴリを使っていた支払いは残るが、カテゴリ JOIN は `null` になり、一覧・詳細では既存のカテゴリ不明表示経路に入る。
- カテゴリ別集計はカテゴリ一覧起点のため、削除済みカテゴリは表示されない。カテゴリなし支払いの扱いは既存の `category_id is null` 側の集計仕様に従う。
- 削除失敗時はカテゴリ一覧や支払い関連 cache を成功扱いで更新しない。

## テスト方針

### DB / RLS

- migration の内容確認:
  - `categories` delete policy が member book 条件で追加されている。
  - `payments(category_id)` と `category_pins(category_id)` の index が追加されている。
  - `category_budgets` への参照や対応を追加していない。
- DBレベルの自動テスト基盤が既存にない場合は、Design Doc 実装時点では migration レビューと型生成差分確認に留める。

### Web unit / integration

- `deleteCategory`:
  - 指定カテゴリIDで `categories` delete を呼ぶ。
  - 削除対象が返らない場合はエラーにする。
  - Supabase error を reject する。
- `useDeleteCategory`:
  - 成功時に `categoryQueryKeys.all`、`paymentQueryKeys.all`、`paymentQueryKeys.detailsAll`、`summaryQueryKeys.categoryTotalsAll` を invalidate する。
  - 失敗時は成功時 invalidate をしない。
- `DeleteCategoryModal`:
  - 対象カテゴリ名を表示する。
  - Delete 成功時に `onSuccess` を呼び、成功 snackbar を出す。
  - Delete 失敗時に dialog を閉じず、失敗 snackbar を出す。
  - 未選択時は Delete を無効化する。
- `CategorySettingsList`:
  - 各カテゴリ行に edit と delete の操作が表示される。
  - 削除成功後、一覧再取得で対象カテゴリが消える。
  - 削除失敗時、対象カテゴリ行が残る。
- 支払い側:
  - 削除済みカテゴリ相当として JOIN 結果が `null` の支払いが一覧・詳細で表示できることを既存または追加テストで確認する。
  - 支払いカテゴリ選択肢は削除後のカテゴリ一覧に従うことを、カテゴリ query invalidate と既存 `useCategories` 経路で確認する。

### 受け入れ条件対応

- AC-1, AC-2: `CategorySettingsList` と `DeleteCategoryModal` の操作テスト。
- AC-3: query invalidate とカテゴリ選択肢の既存取得経路のテスト。
- AC-4: 削除 mutation に支払い利用有無チェックを入れないことを、API呼び出しと UI 操作のテストで確認。
- AC-5, AC-6, AC-7: 支払い JOIN が `null` の支払い一覧・詳細テスト。
- AC-8: `DeleteCategoryModal` 失敗テスト。
- AC-9: migration と UI 差分で `category_budgets` / 予算履歴対応を追加していないことを確認。
- AC-10: 既存カテゴリ作成・名前変更・支払い主要テストを維持。

## 検証コマンド

アプリケーションコード、DB migration、型安全性に影響するため、実装後はリポジトリルートで Web 検証を同一バッチとして実行する。

```sh
pnpm run web:lint
pnpm run web:format-check
pnpm run web:typecheck
pnpm --filter web exec vp test run --project unit --project integration --reporter=dot --silent
```

Storybook browser-test tagged stories、`apps/web/.storybook-test/`、Storybook browser-test 設定を変更する場合のみ、追加で以下を実行する。

```sh
pnpm --filter web test:storybook --reporter=dot --silent
```

## リスクと確認事項

- `categories` delete policy 追加は DB / 権限変更なので、実装時に policy 条件が read / insert / update と同じ Book membership 境界になっていることを重点確認する。
- `payments.category_id on delete set null` は既存契約だが、migration 適用済み環境で FK 名や挙動が保持されているかを確認する。
- `PaymentCategoryFilter` は削除済みIDが URL search に残ると `Unknown category` を表示する。この挙動を変更しない前提で進める。
- 削除後の支払い表示を `Unknown` のままにするか、将来 `Uncategorized` に寄せるかは別判断。今回の実装では既存の `unknownCategory` 経路を維持する。
- category delete 後の cache invalidate 範囲が不足すると、カテゴリ選択肢や支払い詳細に古いカテゴリ名が残るため、`detailsAll` を含めて invalidate する。
