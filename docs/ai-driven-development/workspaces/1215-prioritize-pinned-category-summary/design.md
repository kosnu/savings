# Design Doc: カテゴリ別サマリーでピン留めカテゴリを優先表示できるようにする

## 概要

Requirements / PRD: `docs/ai-driven-development/workspaces/1215-prioritize-pinned-category-summary/requirements.md`

支払い一覧のカテゴリ別サマリーを、ピン留めカテゴリ優先の順序で最大 3 件だけ初期表示し、残りは `Show more` 操作で取得済みデータから表示する。カテゴリ作成・編集フォームではカテゴリのピン留め状態を設定できるようにする。

実装は既存の `category_pins`、Supabase 直接操作、React Query invalidate、Radix Themes のフォーム/ボタンパターンに合わせる。新規依存は追加しない。新規 DB migration は追加せず、既存のカテゴリ表示設定相当である `category_pins` を使う。

## 採用する実装方針

### DB / データ境界

- 既存の `category_pins` をカテゴリ表示設定として使う。
  - `categories` 本体にはピン留め状態を追加しない。
  - `category_pins` は `user_id + category_id` の unique 制約を持ち、カテゴリ削除時は cascade されるため、削除済みカテゴリのピン状態は残らない。
  - Book 所有モデル移行後の membership 検証は既存 trigger / RLS に委ねる。
- 新規 migration は追加しない。
  - 既存型 `Database["public"]["Tables"]["category_pins"]` で insert / delete が表現できるため、`database.types.ts` の更新も不要。
- ピン留め状態の変更は `category_pins` への insert / delete として扱う。
  - pin: `supabase.from("category_pins").insert({ category_id: categoryId }).select("id").single()`
  - unpin: `supabase.from("category_pins").delete().eq("category_id", categoryId).select("id")`
  - unpin は対象行がなくても未ピン留めという最終状態を満たすため成功扱いにする。

### Web: ピン留め mutation

- `apps/web/src/features/categories/updateCategoryPin/` を追加する。
  - `updateCategoryPin.ts`: `categoryId` と `pinned` を受け取り、`category_pins` を insert / delete する。
  - `useUpdateCategoryPin.ts`: mutation を提供し、成功時にカテゴリ系 query とカテゴリ別サマリー query を invalidate する。
  - `categoryPinUpdateError.ts`: ピン留め更新失敗時の表示文言を `Failed to update category pin.` に正規化する。
- invalidate 対象:
  - `invalidateCategoryQueries(queryClient)`
  - `summaryQueryKeys.categoryTotalsAll`
- optimistic update や `setQueryData` は使わない。Query Cache Policy に従い、source of truth 更新後の再取得で反映する。

### Web: カテゴリ作成フォーム

- `categoryCreateSchema` と `CategoryCreateFormValues` に `pinned: boolean` を追加し、初期値は `false` にする。
- `CreateCategoryForm` に Radix Themes `Checkbox` のピン留め入力を追加する。
  - label: `Pin category`
  - name: `pinned`
  - disabled: 送信中または mutation 中
- `createCategory` はカテゴリ作成だけを担当し、作成された category ID を返す既存責務を維持する。
- `useCreateCategory` は作成成功後、`value.pinned === true` の場合に `updateCategoryPin({ categoryId, pinned: true })` 相当の pin insert を実行する。
  - `onSuccess` はカテゴリ作成と pin insert の両方が完了した後にだけ呼ばれる。
  - pin insert が失敗した場合、フォームは失敗表示を出し、成功扱いで閉じない。
  - 既にカテゴリ行が作成された可能性があるため、失敗後は query invalidate によりサーバー状態を再取得できるようにする。

### Web: カテゴリ編集フォーム

- `UpdateCategoryNameModal` は既存の `Edit category` UI を維持しつつ、渡すデータを `CategorySettingsItem` 相当に広げる。
  - `CategorySettingsList` から `category` だけでなく `pinned` も渡す。
  - 表示文言は既存の `Edit category` を維持する。
- `UpdateCategoryNameForm` に `pinned: boolean` を追加する。
  - 初期値は設定一覧取得結果の `item.pinned`。
  - name と pinned の両方をフォーム値として扱う。
- 送信時の流れ:
  - name が変更されている場合のみ `updateCategoryName` を呼ぶ。
  - pinned が変更されている場合のみ `updateCategoryPin` を呼ぶ。
  - どちらも変更されていない場合は `onSuccess` で閉じる。
  - どちらかが失敗した場合は汎用エラーを表示し、成功扱いで閉じない。
- name と pinned の両方を変更した場合の完全な DB transaction は導入しない。
  - 現行の Supabase 直接操作パターンを維持するため。
  - 部分成功が起きた場合は失敗表示と query invalidate によりサーバー状態を再取得し、次操作で整合させる。
  - Build 中に all-or-nothing が必須と判断された場合は、新規 RPC が必要になるため停止して確認する。

### Web: カテゴリ別サマリー取得と並び順

- `fetchCategoryTotals` のカテゴリ取得列に `category_pins` を追加し、各カテゴリの `pinned` を正規化する。
- `CategoryTotals` のデータ構造は `Record<string, CategoryTotal>` から、順序を明示的に持てる配列へ変更する。
  - 例: `CategoryTotalItem[]`
  - `key`: React key とテスト用識別子。登録カテゴリは `category:<id>`、未分類は `uncategorized`。
  - `categoryId`: 登録カテゴリは number、未分類は `null`。
  - `categoryName`, `totalAmount`, `pinned`, `kind` を持たせる。
- 並び順は取得後に明示的に整える。
  1. pinned な登録カテゴリを category ID 昇順
  2. unpinned な登録カテゴリを category ID 昇順
  3. 未分類 `Unknown`
- 未分類 `Unknown` はピン留め不可のサマリー行として扱い、初期表示件数と `Show more` の対象には含める。ただし登録カテゴリの後に置く。
  - これにより、登録カテゴリが 3 件以上ある場合は初期表示に登録カテゴリを優先し、`Unknown` は `Show more` で確認する。
  - 登録カテゴリが 2 件以下で `Unknown` がある場合、初期表示枠に入る。

### Web: カテゴリ別サマリー UI

- `CategoryTotals` に初期表示件数 `initialVisibleCount = 3` を追加する。
- `useState` で表示件数を持ち、初期値は 3 とする。
- 表示対象:
  - `visibleTotals = categoryTotals.slice(0, visibleCount)`
  - `hiddenCount = categoryTotals.length - visibleTotals.length`
- `hiddenCount > 0` の場合だけ `Show more` ボタンを表示する。
  - クリックすると `visibleCount` を `categoryTotals.length` にして残り全件を表示する。
  - 追加取得は行わない。
  - ボタン文言は `Show more` とし、必要なら `aria-label="Show more category totals"` を付ける。
- `categoryTotals` の query 結果が月変更などで変わった場合は、表示件数を 3 に戻す。
- 既存の `splitArray` と 2 列表示は、`visibleTotals` に対して維持する。

## 変更対象

- DB:
  - 新規 migration なし
- Web:
  - `apps/web/src/features/categories/updateCategoryPin/updateCategoryPin.ts`
  - `apps/web/src/features/categories/updateCategoryPin/useUpdateCategoryPin.ts`
  - `apps/web/src/features/categories/updateCategoryPin/categoryPinUpdateError.ts`
  - `apps/web/src/features/categories/createCategory/categoryCreateSchema.ts`
  - `apps/web/src/features/categories/createCategory/CreateCategoryForm/CreateCategoryForm.tsx`
  - `apps/web/src/features/categories/createCategory/useCreateCategory.ts`
  - `apps/web/src/features/categories/updateCategoryName/UpdateCategoryNameForm/UpdateCategoryNameForm.tsx`
  - `apps/web/src/features/categories/updateCategoryName/UpdateCategoryNameModal/UpdateCategoryNameModal.tsx`
  - `apps/web/src/features/categories/components/CategorySettingsList/CategorySettingsList.tsx`
  - `apps/web/src/features/summaryByMonth/CategoryTotals/fetchCategoryTotals.ts`
  - `apps/web/src/features/summaryByMonth/CategoryTotals/CategoryTotals.tsx`
  - `apps/web/src/test/msw/handlers/categorySettings.ts`
  - `apps/web/src/test/msw/handlers/categories.ts`
- Tests:
  - `apps/web/src/features/categories/updateCategoryPin/updateCategoryPin.test.ts`
  - `apps/web/src/features/categories/updateCategoryPin/useUpdateCategoryPin.test.tsx`
  - `apps/web/src/features/categories/createCategory/CreateCategoryForm/CreateCategoryForm.test.tsx`
  - `apps/web/src/features/categories/createCategory/useCreateCategory.test.tsx`
  - `apps/web/src/features/categories/updateCategoryName/UpdateCategoryNameForm/UpdateCategoryNameForm.test.tsx`
  - `apps/web/src/features/categories/components/CategorySettingsList/CategorySettingsList.test.tsx`
  - `apps/web/src/features/summaryByMonth/CategoryTotals/fetchCategoryTotals.integration.test.ts`
  - `apps/web/src/features/summaryByMonth/CategoryTotals/CategoryTotals.test.tsx`
  - 必要に応じて `useCategoryTotals.test.tsx`

コンポーネントを追加または切り出す場合は `apps/web/docs/policies/component-structure.md` に従い、コンポーネント名ディレクトリと `index.ts` を置く。今回の最小実装では、新規コンポーネントを作らず各既存フォーム内に Checkbox を追加する。

## 採用しない案

- `categories` に `pinned` カラムを追加する案は採用しない。PRD の「カテゴリ本体ではなくカテゴリ表示設定として扱う」に反する。
- 新しい `category_display_settings` テーブルを追加する案は採用しない。既存の `category_pins` が同等の表示設定として存在し、関連 RLS / membership / cascade があるため。
- カテゴリ別サマリーをサーバーから 3 件だけ取得する案は採用しない。PRD は取得済みデータの段階表示を要求している。
- `Show more` で追加ページングする案は採用しない。追加取得ではなく画面上の表示切り替えにする。
- `Record<string, CategoryTotal>` のまま表示順を暗黙の object key 順に依存する案は採用しない。ピン留め優先順と `Unknown` の配置を明示できないため。
- ピン留め状態を React Query cache だけに持つ案は採用しない。Query Cache Policy に反する。
- name と pinned を更新するためだけに新規 RPC を追加する案は初期実装では採用しない。既存の直接操作パターンで実現し、all-or-nothing が必須になった場合に停止して再設計する。

## 既存挙動への影響

- 支払い一覧、月選択、月合計、カテゴリ別サマリーの取得対象月は既存のまま維持する。
- カテゴリ別サマリーは全件取得を維持するが、初期表示は最大 3 件になる。
- 3 件を超えるカテゴリ別サマリーは `Show more` 操作後に表示される。
- カテゴリ別サマリーの表示順は、従来の ID 昇順から「ピン留め優先 + ID 昇順」に変わる。
- 未分類 `Unknown` は引き続きカテゴリとは別 key のサマリーとして表示するが、表示順では登録カテゴリの後に置く。
- 設定画面のカテゴリ一覧にある `Pin` バッジ表示は維持し、作成・編集フォームから状態を変えられるようになる。
- カテゴリ作成、名前変更、削除の既存主要挙動は維持する。
- ピン留め状態変更後はカテゴリ設定一覧とカテゴリ別サマリーを再取得し、古いピン状態が残らないようにする。

## テスト方針

### Web unit / integration

- `updateCategoryPin`:
  - `pinned: true` で `category_pins` insert を呼ぶ。
  - `pinned: false` で `category_pins` delete を呼ぶ。
  - Supabase error を reject する。
  - unpin 対象が存在しない場合も最終状態が未ピン留めなら resolve する。
- `useUpdateCategoryPin`:
  - 成功時に `categoryQueryKeys.all` と `summaryQueryKeys.categoryTotalsAll` を invalidate する。
  - 失敗時は成功時 invalidate をしない。
- `CreateCategoryForm` / `useCreateCategory`:
  - 初期状態では `Pin category` が未チェック。
  - チェックありで作成すると、カテゴリ作成後に pin insert が呼ばれる。
  - チェックなしで作成すると、pin insert は呼ばれない。
  - pin insert 失敗時はエラーを表示して `onSuccess` を呼ばない。
  - 送信中は name 入力、pin checkbox、操作ボタンを無効化する。
- `UpdateCategoryNameForm`:
  - 既存の name 初期値に加えて pinned 初期値を表示する。
  - pin 状態だけを変更して保存できる。
  - name と pin の両方を変更して保存できる。
  - pin 更新失敗時はエラーを表示して `onSuccess` を呼ばない。
  - 変更なし保存は不要な mutation を呼ばずに閉じる。
- `CategorySettingsList`:
  - `pinned` を `UpdateCategoryNameModal` に渡す。
  - ピン留め済みカテゴリの `Pin` バッジ表示を維持する。
- `fetchCategoryTotals`:
  - category query の select に `category_pins` が含まれる。
  - pinned / unpinned / `Unknown` を含む配列に正規化する。
  - 並び順が pinned ID 昇順、unpinned ID 昇順、`Unknown` の順になる。
  - レスポンス shape が不正なら既存どおりエラーにする。
- `CategoryTotals`:
  - 4 件以上ある場合、初期表示は 3 件。
  - 3 件以下の場合、`Show more` は表示しない。
  - `Show more` クリックで残り全件を表示する。
  - ピン留め優先順を維持したまま初期 3 件を表示する。
  - 月や query 結果が変わった場合、表示件数が初期値に戻る。
  - `Unknown` という名前の登録カテゴリと未分類 `Unknown` は別行のまま表示される。

### 受け入れ条件対応

- AC-1, AC-2: `CategoryTotals` の 3 件以下 / 4 件以上表示テスト。
- AC-3, AC-4, AC-5, AC-6: `fetchCategoryTotals` の並び順テストと `CategoryTotals` の初期表示テスト。
- AC-7, AC-8: `CategoryTotals` の `Show more` テスト。追加 network request が不要なことは既存取得結果を使う component test で確認する。
- AC-9: `CreateCategoryForm` / `useCreateCategory` の pin 作成テスト。
- AC-10: `UpdateCategoryNameForm` の pin 確認・変更テスト。
- AC-11: DB 差分なし、`category_pins` insert / delete、`categories` に pinned を保存しないことを `updateCategoryPin` と create/update request テストで確認。
- AC-12: 作成時 pin insert 失敗、編集時 pin update 失敗のフォームテスト。
- AC-13: 既存のカテゴリ作成、名前変更、削除、カテゴリ別サマリー、支払い一覧主要テストを維持。

## 検証コマンド

アプリケーションコードと型安全性に影響するため、実装後はリポジトリルートで Web 検証を同一バッチとして実行する。

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

- カテゴリ作成と pin insert、カテゴリ名更新と pin 更新は複数 request になる。完全な transaction が必要だと判明した場合、新規 RPC が必要になるため Build 中に停止して確認する。
- `category_pins` の select / insert / delete は user 境界と Book membership 境界に依存するため、RLS と trigger の既存契約を壊さないことを重点確認する。
- `fetchCategoryTotals` の返却型を配列へ変更するため、既存テストと呼び出し側の期待値更新漏れに注意する。
- `Unknown` はピン留めできないため、登録カテゴリが多い場合は初期表示から外れる。この方針は本 Design Doc の決定として扱う。
- `Show more` 後に月変更や query 結果変更が起きた場合、表示件数が 3 に戻ることを確認する。
- ピン留め状態の変更後にカテゴリ別サマリー query の invalidate が漏れると、支払い一覧に古い順序が残る。
