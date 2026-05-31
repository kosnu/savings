# Design Doc: カテゴリ別サマリーでピン留めカテゴリを優先表示できるようにする

## 概要

Requirements / PRD: `docs/ai-driven-development/workspaces/1215-prioritize-pinned-category-summary/requirements.md`

支払い一覧のカテゴリ別サマリーは、ピン留めカテゴリを優先しつつ初期表示を最大 3 件に抑える。4 件目以降は追加取得ではなく、取得済みデータを `Show more` 操作で画面上に表示する。

カテゴリ作成・編集フォームではピン留め状態を設定できるようにする。ただし、ピン留め登録数は最大 3 件とし、4 件目のピン留め登録は成功扱いにしない。

ピン留め状態は `categories` 本体ではなく、既存のカテゴリ表示設定である `category_pins` に保存する。カテゴリ作成 + ピン作成、カテゴリ更新 + ピン作成/削除は、片方だけが成功する状態を避けるため同一操作単位で扱う。

## 現行実装からの差し戻し

現在の実装候補には、カテゴリ作成後に `category_pins` を別 request で insert する経路、カテゴリ名更新後に `category_pins` を別 request で insert / delete する経路、独立した `updateCategoryPin` mutation がある。

これらは PRD の「カテゴリ作成・更新とピン留め状態変更の片方だけが成功する状態を避ける」に反するため、この Design Doc では採用しない。Build / Verify では、独立 `updateCategoryPin` 前提の実装とテストを、同一操作単位の設計に置き換える。

## 採用する実装方針

### DB / API 境界

- ピン留め保存先は既存の `category_pins` とする。
  - `categories` に `pinned` カラムは追加しない。
  - `category_pins` の `user_id + category_id` unique、カテゴリ削除時 cascade、Book membership 検証は既存契約として維持する。
- カテゴリ作成 + ピン作成、カテゴリ更新 + ピン作成/削除は同一 DB transaction 境界で扱う。
  - 第一候補は Supabase RPC / DB function。
  - 既存の `create_category_with_budget` / `update_category_with_budget` と同じく `security invoker set search_path = public`、`authenticated` への execute grant、RLS / trigger による境界チェックを前提にする。
- ピン留め登録数の上限は最大 3 件とする。
  - DB constraint / trigger で固定値として縛らない。
  - 上限判定は Web / アプリケーション層で行う。
  - RPC / DB function 内では pin 件数の count、上限超過の例外化、上限担保のための lock を行わない。
  - RPC / DB function は、呼び出し側が渡した最終 pinned 状態を同一操作単位で保存する責務に限定する。
  - アプリケーション層の判定が古い場合、同時操作で 4 件目が作られる競合リスクは残る。このリスクは DB 側で隠さず、残リスクとして扱う。

### RPC / DB Function

追加候補:

- `create_category_with_pin(p_category_name text, p_pinned boolean) returns bigint`
- `update_category_with_pin(p_category_id bigint, p_category_name text, p_pinned boolean) returns void`

`create_category_with_pin`:

- 認証ユーザーの default book を取得する。
- `categories(book_id, name)` を作成し、作成された category ID を返す。
- `p_pinned = true` の場合、作成された category ID を `category_pins` に insert する。
- ピン作成に失敗した場合はカテゴリ作成も成功扱いにしない。

`update_category_with_pin`:

- 対象カテゴリの name を更新する。
- 更新対象が存在しない、または RLS / membership により更新できない場合は失敗にする。
- `p_pinned = true` の場合:
  - 既に pin がある場合は重複 insert しない。
  - pin がない場合、`category_pins` を insert する。
- `p_pinned = false` の場合、対象カテゴリの pin を delete する。既に pin がない場合は成功扱いでよい。
- name 更新と pin insert / delete の片方だけが成功する状態にしない。

エラー:

- RPC / DB function は pin 上限超過を判定しない。
- 4 件目のピン留めは Web 側で mutation 前に失敗扱いにし、RPC を呼ばない。
- RPC エラーはカテゴリ作成 / 更新または pin 保存自体の失敗として扱う。
- エラーメッセージは既存のカテゴリ作成・名前変更エラー変換に合わせ、ユーザーが失敗を認識できる表示にする。

### Web: ピン留め上限制御

- ピン留め登録数の最大 3 件制御は、カテゴリ作成・編集フォームの送信前に Web / アプリケーション層で行う。
- 判定にはカテゴリ表示設定として取得済みの pinned 状態を使う。
- カテゴリ作成で `pinned = true` を送信する場合:
  - 現在の pin 数が 3 件未満なら `create_category_with_pin` RPC を呼ぶ。
  - 現在の pin 数が 3 件以上なら RPC を呼ばず、フォーム上にエラーを表示し、成功扱いにしない。
- カテゴリ編集で未ピン留めからピン留めへ変更する場合:
  - 現在の pin 数が 3 件未満なら `update_category_with_pin` RPC を呼ぶ。
  - 現在の pin 数が 3 件以上なら RPC を呼ばず、フォーム上にエラーを表示し、成功扱いにしない。
- 既にピン留め済みのカテゴリの名前変更、ピン留め解除、未ピン留めのままの名前変更は、pin 数上限に関係なく送信できる。
- 成功後はカテゴリ設定とカテゴリ別サマリーを再取得し、古い pin 数や表示順に依存し続けない。

### Web: カテゴリ作成

- `categoryCreateSchema` / `CategoryCreateFormValues` に `pinned: boolean` を含める。
- `CreateCategoryForm` に `Pin category` checkbox を追加し、初期値は `false` とする。
- `pinned = true` で現在の pin 数が 3 件以上の場合は、送信前に失敗扱いにして RPC を呼ばない。
- `createCategory` は `categories` への直接 insert ではなく `create_category_with_pin` RPC を呼ぶ。
- `useCreateCategory` は独立した pin mutation を呼ばない。
- 成功時に invalidate する query:
  - `invalidateCategoryQueries(queryClient)`
  - `summaryQueryKeys.categoryTotalsAll`
- 失敗時はフォーム上にエラーを表示し、modal を成功扱いで閉じない。

### Web: カテゴリ編集

- `UpdateCategoryNameModal` / `UpdateCategoryNameForm` は、既存の edit UI を維持しつつ `category.id`, `category.name`, `category.pinned` を受け取る。
- フォーム値は `name` と `pinned` を持つ。
- 送信時:
  - name または pinned が変更されている場合、`update_category_with_pin` RPC を 1 回呼ぶ。
  - どちらも変更されていない場合は mutation を呼ばず閉じる。
  - 未ピン留めからピン留めへ変更し、現在の pin 数が 3 件以上の場合は、送信前に失敗扱いにして RPC を呼ばない。
- `UpdateCategoryNameForm` は `useUpdateCategoryName` と `useUpdateCategoryPin` を順番に呼ぶ実装にしない。
- 成功時に invalidate する query:
  - `invalidateCategoryQueries(queryClient)`
  - `summaryQueryKeys.categoryTotalsAll`
  - カテゴリ名変更を含むため、既存どおり payment list / detail 系 query
- 失敗時はフォーム上にエラーを表示し、name だけ成功または pin だけ成功したものとして扱わない。

### Web: カテゴリ別サマリー取得

- `fetchCategoryTotals` は `categories` 起点で `category_pins` を select し、各カテゴリの `pinned` を正規化する。
- 戻り値は順序を明示できる配列にする。
  - `key`: 登録カテゴリは `category:<id>`、未分類は `uncategorized`
  - `categoryId`: 登録カテゴリは number、未分類は `null`
  - `categoryName`
  - `totalAmount`
  - `pinned`
  - `kind`: `category` または `uncategorized`
- 並び順:
  1. pinned な登録カテゴリを category ID 昇順
  2. unpinned な登録カテゴリを category ID 昇順
  3. 未分類 `Unknown`
- 未分類 `Unknown` はピン留め不可のサマリー行として扱う。
  - 初期表示件数と `Show more` の対象には含める。
  - 登録カテゴリの後に置くため、登録カテゴリが 3 件以上ある場合は初期表示から外れる。

### Web: カテゴリ別サマリー UI

- `CategoryTotals` の初期表示件数は 3 件とする。
- `Show more` は `categoryTotals.length > visibleCount` の場合だけ表示する。
- `Show more` クリック時は追加 network request を行わず、取得済み配列の残りを表示する。
- `Show more` 後に月変更または集計結果変更が起きた場合、表示件数を 3 件へ戻す。
  - `key` 一覧だけでは、同じカテゴリ構成で `totalAmount` や `pinned` だけが変わるケースを検知できない。
  - reset 判定には対象月、`key`、`totalAmount`、`pinned`、`kind` を含める。
  - 実装は render key による remount、または React の lint 方針に沿う `useEffect` reset のどちらかを採用する。
- 既存の 2 列表示と `splitArray` は、表示対象の配列に対して維持する。

## 変更対象ファイル・モジュール

### API / DB

- `apps/api/supabase/migrations/`
  - `create_category_with_pin`
  - `update_category_with_pin`
  - 必要な grant / revoke
- `apps/web/src/types/database.types.ts`
  - Supabase 型生成または RPC 型の更新

### Web

- `apps/web/src/features/categories/createCategory/categoryCreateSchema.ts`
- `apps/web/src/features/categories/createCategory/createCategory.ts`
- `apps/web/src/features/categories/createCategory/useCreateCategory.ts`
- `apps/web/src/features/categories/createCategory/CreateCategoryForm/CreateCategoryForm.tsx`
- `apps/web/src/features/categories/updateCategoryName/categoryNameUpdateMappers.ts`
- `apps/web/src/features/categories/updateCategoryName/updateCategoryName.ts`
- `apps/web/src/features/categories/updateCategoryName/useUpdateCategoryName.ts`
- `apps/web/src/features/categories/updateCategoryName/UpdateCategoryNameForm/UpdateCategoryNameForm.tsx`
- `apps/web/src/features/categories/updateCategoryName/UpdateCategoryNameModal/UpdateCategoryNameModal.tsx`
- `apps/web/src/features/categories/components/CategorySettingsList/CategorySettingsList.tsx`
- `apps/web/src/features/summaryByMonth/CategoryTotals/fetchCategoryTotals.ts`
- `apps/web/src/features/summaryByMonth/CategoryTotals/CategoryTotals.tsx`
- `apps/web/src/test/msw/handlers/categorySettings.ts`
- `apps/web/src/test/msw/handlers/categories.ts`

### 削除または縮小候補

- `apps/web/src/features/categories/updateCategoryPin/updateCategoryPin.ts`
- `apps/web/src/features/categories/updateCategoryPin/useUpdateCategoryPin.ts`
- `apps/web/src/features/categories/updateCategoryPin/categoryPinUpdateError.ts`
- 上記に対応する test

独立 pin update が他用途で必要なければ削除する。将来の単独 pin 操作用に残す場合でも、カテゴリ作成・編集フォームからは呼ばない。

## 採用しない案

- `categories` に `pinned` カラムを追加する案は採用しない。PRD の「カテゴリ本体ではなくカテゴリ表示設定として扱う」に反するため。
- 新しい `category_display_settings` テーブルを追加する案は採用しない。既存の `category_pins` がカテゴリ表示設定として存在するため。
- カテゴリ作成後に別 request で `category_pins` を insert する案は採用しない。カテゴリだけ作成される片成功が起き得るため。
- カテゴリ名更新後に別 request で `category_pins` を insert / delete する案は採用しない。名前だけ更新される片成功が起き得るため。
- 独立した `updateCategoryPin` mutation をカテゴリ作成・編集フローで使う案は採用しない。同一操作単位の要件に反するため。
- ピン留め最大 3 件を DB constraint / trigger で固定する案は採用しない。将来増減の可能性があり、PRD の制約に反するため。
- RPC / DB function 内で pin 件数を count して上限超過を例外にする案は採用しない。ピン留め登録数の上限は Web / アプリケーション層で制御するため。
- ピン留め登録数の上限担保のために DB lock / advisory lock を使う案は採用しない。上限判定を DB 側へ持ち込むことになるため。
- カテゴリ別サマリーをサーバーから 3 件だけ取得する案は採用しない。PRD は取得済みデータの段階表示を要求しているため。
- `Show more` でページングや追加取得を行う案は採用しない。
- `Record<string, CategoryTotal>` の object key 順に表示順を依存する案は採用しない。ピン優先順と `Unknown` の配置を明示できないため。
- ピン留め状態を React Query cache だけに保持する案は採用しない。source of truth 側の更新と再取得で整合させるため。

## 既存挙動への影響

- 支払い一覧、月選択、月合計、支払い一覧本体の取得対象月は維持する。
- カテゴリ別サマリーは全件取得を維持するが、初期表示は最大 3 件になる。
- カテゴリ別サマリーの表示順は、従来のカテゴリ ID 昇順から「ピン留め優先 + カテゴリ ID 昇順」に変わる。
- 4 件目以降のサマリーは `Show more` で表示される。
- 未分類 `Unknown` は引き続き表示するが、登録カテゴリの後ろに置く。
- カテゴリ作成・編集フォームに `Pin category` checkbox が増える。
- 4 件目のピン留め作成・更新は失敗表示になり、成功扱いにならない。
- カテゴリ削除時に `category_pins` が cascade される既存挙動は維持する。
- ピン留め状態変更後は設定画面とカテゴリ別サマリーを再取得し、古い順序や Pin バッジが残らないようにする。

## テスト方針

### API / DB

- `create_category_with_pin`
  - `p_pinned = false` ではカテゴリのみ作成される。
  - `p_pinned = true` ではカテゴリと pin が同一操作で作成される。
  - pin 上限判定用の引数を持たず、RPC 内で pin 件数チェックを行わない。
  - pin 作成に失敗した場合、カテゴリだけ作成された状態にならない。
  - RLS / Book membership に反する操作は失敗する。
- `update_category_with_pin`
  - name のみ変更できる。
  - pinned のみ変更できる。
  - name と pinned を同時に変更できる。
  - pin 上限判定用の引数を持たず、RPC 内で pin 件数チェックを行わない。
  - pin 作成 / 削除に失敗した場合、name だけ更新された状態にならない。
  - unpin は既に pin がない場合でも成功扱いでよい。

### Web unit / integration

- `CreateCategoryForm` / `useCreateCategory`
  - 初期状態で `Pin category` は未チェック。
  - checked / unchecked の値を RPC に渡す。
  - pin 数が 3 件ある状態で checked を送信した場合、RPC を呼ばずにエラーを表示し、`onSuccess` を呼ばない。
  - 独立 `category_pins` request を発生させない。
  - 成功時にカテゴリ query とカテゴリ別サマリー query を invalidate する。
- `UpdateCategoryNameForm` / `useUpdateCategoryName`
  - 既存の pinned 初期値を表示する。
  - name のみ、pin のみ、name + pin を保存できる。
  - 変更なし保存は不要な mutation を呼ばず閉じる。
  - pin 数が 3 件ある状態で未ピン留めからピン留めへ変更した場合、RPC を呼ばずにエラーを表示し、`onSuccess` を呼ばない。
  - 独立 `category_pins` request を発生させない。
  - 成功時にカテゴリ query、payment query、カテゴリ別サマリー query を invalidate する。
- `CategorySettingsList`
  - `pinned` を編集 modal に渡す。
  - 既存の `Pin` バッジ表示を維持する。
- `fetchCategoryTotals`
  - `category_pins` を select し、`pinned` を正規化する。
  - pinned ID 昇順、unpinned ID 昇順、`Unknown` の順に並ぶ。
  - `Unknown` という名前の登録カテゴリと未分類 `Unknown` を別行として扱う。
  - レスポンス shape が不正な場合は既存どおりエラーにする。
- `CategoryTotals`
  - カテゴリ別サマリー行が 4 件以上ある場合、初期表示は 3 件。
  - 3 件以下の場合、`Show more` は表示しない。
  - `Show more` クリックで取得済みデータの残りを表示する。
  - 追加 network request を発生させない。
  - `Show more` 後、月変更または `totalAmount` / `pinned` を含む集計結果変更で表示件数が 3 件に戻る。

### 受け入れ条件対応

- AC-1, AC-2: `CategoryTotals` の初期表示件数と 3 件以下表示。
- AC-3, AC-4, AC-5, AC-6: `fetchCategoryTotals` の並び順と `CategoryTotals` の初期表示。
- AC-7, AC-8: `CategoryTotals` の `Show more` と追加 request 不要の確認。
- AC-9: `Show more` 後、月変更または集計結果変更で初期表示件数へ戻ること。
- AC-10: `CreateCategoryForm` / `useCreateCategory` の pinned 送信。
- AC-11: `UpdateCategoryNameForm` / `useUpdateCategoryName` の pinned 表示・変更。
- AC-12, AC-13: Web / アプリケーション層で pin 3 件到達時の 4 件目作成・更新を送信前に失敗扱いにすること。
- AC-14: `categories` ではなく `category_pins` を使う RPC / request テスト。
- AC-15: カテゴリ作成/更新と pin 作成/削除が同一操作単位で扱われ、片成功にならないこと。
- AC-16: 作成・編集時の失敗表示と成功扱いにならないこと。
- AC-17: 既存のカテゴリ作成、カテゴリ編集、カテゴリ削除、カテゴリ別サマリー、支払い一覧の主要テスト維持。

## 検証コマンド

Design Doc 作成時点では実装しないため、アプリ検証コマンドは不要。

Build / Verify でアプリケーションコード、DB migration、型定義を変更した後は、リポジトリルートで Web 検証を同一バッチとして実行する。

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

- この設計は DB / API 変更を必要とする。Design / Plan Goal ではここで止め、Build / Verify へ自動で進まない。
- ピン留め登録数の上限は Web / アプリケーション層で制御するため、複数画面・同時操作では 4 件目が作られる競合リスクが残る。今回の設計では DB constraint / trigger / RPC 内制限では塞がない。
- `category_pins` は user 境界と Book membership 境界に依存するため、既存 RLS / trigger / function grant を壊さないことを確認する必要がある。
- Supabase 型生成が必要な場合、`database.types.ts` の更新方法と検証範囲を Build / Verify で明確にする。
- 既存の独立 `updateCategoryPin` 実装とテストを削除するか、将来用途として残すかを Build / Verify 開始時に決める必要がある。
- `Show more` の reset 判定に `totalAmount` と `pinned` を含めないと、同じカテゴリ構成で集計結果だけ変わった場合に表示件数が戻らない。
- 未分類 `Unknown` を登録カテゴリの後ろに置くため、登録カテゴリが 3 件以上ある月では初期表示から外れる。この方針は本 Design Doc の決定とする。
