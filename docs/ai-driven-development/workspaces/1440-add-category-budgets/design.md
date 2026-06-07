# Design Doc: カテゴリ別予算機能を追加する

## 概要

Requirements / PRD: `docs/ai-driven-development/workspaces/1440-add-category-budgets/requirements.md`

カテゴリ別予算は、カテゴリに紐づく月ごとの予算状態として再導入する。既存の月次予算と同じく、金額あり状態と予算なし状態を区別し、対象月末日以前に開始した最新状態を有効状態として扱う。

カテゴリ作成・更新・削除は、カテゴリ本体、ピン状態、カテゴリ別予算状態を別関心として保持しつつ、ユーザーから 1 回の操作に見える箇所では RPC / DB transaction で同一操作単位にする。

支払い一覧のカテゴリ別サマリーは、カテゴリ支出額、ピン状態、対象月のカテゴリ別予算状態を 1 つの read shape として取得する。スマホでは 1 列表示にし、デスクトップでは既存の 2 列表示を維持する。

## 採用する実装方針

### DB 構造

- `category_budgets` を再作成する。
  - `id bigint generated always as identity primary key`
  - `book_id bigint not null references books(id) on delete cascade`
  - `category_id bigint not null references categories(id) on delete cascade`
  - `effective_from date not null`
  - `effective_year integer generated always as (...) stored not null`
  - `effective_month integer generated always as (...) stored not null`
  - `status text not null default 'amount'`
  - `amount integer null`
  - `created_at`, `updated_at`
- unique は `book_id, category_id, effective_year, effective_month` とする。
- index は `(book_id, category_id, effective_from desc)` とする。
- `status` は `amount` / `none` を許可する。
  - `status = 'amount'` の場合は `amount is not null`。
  - `status = 'none'` の場合は `amount is null`。
- 0 円予算は `status = 'amount'` かつ `amount = 0` として扱い、予算なしと区別する。
- `category_id` は `on delete cascade` とする。カテゴリ削除が成功した場合、紐づく予算状態も残さない。
- 旧 `category_budgets` は `on delete restrict` だったが、PRD の AC-9 / AC-11 を満たすため採用しない。
- RLS を有効にし、Book member だけが参照・作成・更新・削除できる policy を置く。
- Web の通常操作は RPC 経由に寄せ、カテゴリ作成・更新・削除と予算変更の同一操作境界を UI と service 関数で維持する。

### 有効状態

- カテゴリ別予算は月別の状態イベントとして扱う。
- 対象月の有効状態は、対象月末日以前に開始した同一 Book・同一カテゴリの `category_budgets` のうち、`effective_from desc limit 1` の行で決める。
- 該当行がない場合は `unset`。
- 最新行が `status = 'none'` の場合は `none`。
- 最新行が `status = 'amount'` の場合は金額あり予算。
- `none` が最新状態の場合、さらに過去の金額あり予算は対象月に復活しない。

### RPC / DB 境界

既存の `create_category_with_pin` / `update_category_with_pin` を、カテゴリ別予算も扱う RPC へ置き換える。

- `create_category_with_settings(p_category_name text, p_pinned boolean, p_budget_amount integer default null) returns bigint`
  - default book にカテゴリを作成する。
  - `p_pinned = true` の場合は `category_pins` を作成する。
  - `p_budget_amount is not null` の場合は、当月月初の `category_budgets(status='amount')` を作成する。
  - カテゴリ、ピン、予算の片方だけが成功した状態を成功扱いにしない。
- `update_category_with_settings(p_category_id bigint, p_category_name text, p_pinned boolean, p_budget_status text, p_budget_amount integer default null) returns void`
  - カテゴリ名を更新する。
  - `p_pinned` に応じて `category_pins` を作成または削除する。
  - `p_budget_status = 'amount'` の場合、当月のカテゴリ別予算を作成または更新する。
  - `p_budget_status = 'none'` の場合、当月以降を予算なしにする状態を作成または更新する。
  - `p_budget_status = 'unchanged'` の場合、カテゴリ別予算は変更しない。
  - カテゴリ、ピン、予算の片方だけが成功した状態を成功扱いにしない。
- カテゴリ削除は既存の `categories` delete を維持する。
  - `category_pins` と `category_budgets` は FK cascade で削除される。
  - 予算だけ削除される失敗状態を作らない。

### Read Shape

- 設定画面の取得は `list_category_settings_items()` RPC に置き換える。
  - `categories`、`category_pins`、各カテゴリの当月有効な `category_budgets` 状態を 1 つの DTO として返す。
  - 設定画面は当月以降のカテゴリ予算を編集する画面として扱うため、現在有効状態の基準月は DB の `current_date` の月とする。
  - 予算状態は `amount` / `none` / `unset` の discriminated union として Web 側で正規化する。
- 支払い一覧カテゴリ別サマリーは `get_category_totals_with_budgets(p_start_date date, p_end_date date)` RPC に置き換える。
  - 対象月は `p_start_date` の月とする。既存の月次サマリは月初から月末の範囲を渡すため、支払い集計範囲とカテゴリ別予算の対象月を同じ入力から決める。
  - カテゴリごとの支出額、ピン状態、対象月のカテゴリ別予算状態を 1 つの DTO として返す。
  - 未分類支出も同じ DTO 配列に含める。
- 支払い一覧カテゴリ別サマリー DTO は次を持つ。
  - `categoryId`
  - `categoryName`
  - `totalAmount`
  - `pinned`
  - `budgetState: "amount" | "none" | "unset"`
  - `budgetAmount: number | null`
  - `kind: "category" | "uncategorized"`
- 未分類 `Unknown` はカテゴリ別予算の対象外なので、`budgetState = "unset"` / `budgetAmount = null` と同等に扱う。

### UI 方針

- カテゴリ作成フォーム:
  - 既存の `Name`、`Pin category` に `Budget` を追加する。
  - `Budget` は任意入力。空は未設定。
  - 0 は有効な金額あり予算。
- カテゴリ更新フォーム:
  - 現在のカテゴリ別予算状態を表示する。
  - `Budget` に金額を入力すると当月以降の金額あり予算として保存する。
  - `Remove budget` で当月以降を予算なしにする。
  - 予算なし状態と未設定状態は、内部状態では区別する。表示はどちらも予算額を出さない。
- 支払い一覧カテゴリ別サマリー:
  - 予算あり行は支出額と予算額を表示する。
  - 予算なし / 未設定 / 未分類は予算額を表示しない。
  - 残額 / 超過額は初期実装では表示しない。PRD は「カテゴリ別予算を確認できる」ことを要求しており、残額表示は追加判断になるため。
- スマホ:
  - `CategoryTotals` の `chunkSize` を responsive にし、スマホは 1、`sm` 以上は 2 とする。
  - カテゴリ名、支出額、予算額は同一行内で重ならないよう、金額側を縦積みまたは短い補助行にする。
- デスクトップ:
  - 既存の 2 列表示、初期表示 3 件、`Show more` を維持する。

## ユーザー向け主要文言

- カテゴリ作成/更新フォーム:
  - label: `Budget`
  - remove action: `Remove budget`
  - budget empty helper: 表示しない
- 支払い一覧サマリー:
  - 予算あり: `Budget`
  - 予算なし / 未設定: 予算行を表示しない
  - 取得失敗: 既存の `Failed`
- エラー:
  - 作成時: `Failed to create category.`
  - 更新時: `Failed to update category.`
  - 削除時: `Failed to delete category.`
  - 予算保存を含む操作でも、ユーザーからはカテゴリ保存全体の失敗として表示する。

## 変更対象ファイル・モジュール

### API / DB

- `apps/api/supabase/migrations/<timestamp>_recreate_category_budgets.sql`
- `apps/api/supabase/migrations/<timestamp>_update_category_settings_functions.sql`
- `apps/api/supabase/migrations/<timestamp>_add_category_budget_read_functions.sql`
- `apps/web/src/types/database.types.ts`

### Web

- `apps/web/src/features/categories/createCategory/`
- `apps/web/src/features/categories/updateCategoryName/`
- `apps/web/src/features/categories/deleteCategory/`
- `apps/web/src/features/categories/listCategorySettings/`
- `apps/web/src/features/categories/components/CategorySettingsList/`
- `apps/web/src/features/summaryByMonth/CategoryTotals/`
- `apps/web/src/test/msw/handlers/categorySettings.ts`
- `apps/web/src/test/msw/handlers/categories.ts`

### ドキュメント

- `docs/domain/category-budget.md`
  - Book 所有境界、状態、0 円予算、予算なし、削除後状態を明文化する。

## 採用しない案

- `categories` に `budget_amount` を追加する案は採用しない。カテゴリ本体と予算状態を同一永続データに混ぜ、月別表示や削除後状態を扱いづらい。
- 現在値だけを `category_budgets` に 1 行で持つ案は採用しない。支払い一覧サマリーは対象月を持つため、過去月表示が現在値で上書きされる。
- 物理削除だけで予算削除を表す案は採用しない。過去状態の復活や予算なし意図の曖昧さを避けられない。
- 0 円を予算なしとして扱う案は採用しない。金額ドメインでは 0 以上が有効であり、0 円予算と予算なしを区別する必要がある。
- 旧 `create_category_with_budget` / `update_category_with_budget` をそのまま復活させる案は採用しない。旧設計は `on delete restrict`、`amount numeric(10,2)`、予算なし状態なしで、現在の PRD と月予算ドメインに合わない。
- 支払い一覧サマリーで残額 / 超過額まで表示する案は初期実装では採用しない。画面密度と文言判断が増えるため、まず予算額の確認に絞る。
- カテゴリ別予算取得をカテゴリ支出額取得とは別 request にする案は採用しない。サマリーで 1 つの表示として見えるため、対象月に対して整合した read shape を優先する。

## ドメインルールとの整合

- Book: `category_budgets.book_id` は Book 所有境界に属し、対象 Book の member だけが参照・作成・更新・削除できる。
- Amount: 金額は整数かつ 0 以上。0 円は `amount` 状態として有効。
- Date: `effective_from` は対象月の月初日として保存する。
- Monthly budget: `amount` / `none` / `unset` と「対象月末日以前の最新状態」をカテゴリ別予算にも適用する。ただしカテゴリ別予算はカテゴリに紐づく。

## 既存挙動への影響

- 月次予算、全体予算、支払い登録・更新フローは変更しない。
- カテゴリ作成・更新フォームは入力項目が増えるが、カテゴリだけの作成・更新は維持する。
- カテゴリ削除時、支払い自体は削除されない既存挙動を維持する。
- カテゴリ別サマリーはピン優先、初期表示 3 件、`Show more` を維持する。
- スマホではカテゴリ別サマリーが 1 列になる。

## 受け入れ条件とテスト方針

- AC-1 / AC-2: `CreateCategoryForm` と `create_category_with_settings` で、予算あり/なしの作成を確認する。
- AC-3: RPC の失敗テストで、カテゴリだけ作成された片成功が起きないことを確認する。
- AC-4: `fetchCategorySettingsItems` と更新フォームで、現在の予算状態を表示できることを確認する。
- AC-5 / AC-6 / AC-7: 更新フォームと RPC で、未設定から登録、金額更新、予算なし化を確認する。
- AC-8: 更新 RPC の失敗テストで、カテゴリ名や pin だけ更新される片成功が起きないことを確認する。
- AC-9 / AC-10 / AC-11: カテゴリ削除後、支払いは残り、ピンと予算は残らないことを DB / Web integration test で確認する。
- AC-12 / AC-13 / AC-14: `fetchCategoryTotals` と `CategoryTotals` で、予算あり、予算なし、未設定、未分類を確認する。
- AC-15: ピン優先、初期表示 3 件、`Show more` が予算表示後も成立することを確認する。
- AC-16 / AC-17: `CategoryTotals` の component test または Storybook browser-test で、スマホ 1 列表示と重なりがないことを確認する。
- AC-18: 作成、更新、削除、サマリー取得失敗時に失敗表示が出て成功扱いにならないことを確認する。
- AC-19: 0 円予算と予算なしを mapper / UI test で区別する。
- AC-20: 既存の月次予算、支払い、カテゴリ、カテゴリサマリー tests を維持する。

## 検証コマンド

実装後はリポジトリルートで次を同一バッチとして実行する。

```sh
pnpm run web:lint
pnpm run web:format-check
pnpm run web:typecheck
pnpm --filter web exec vp test run --project unit --project integration --reporter=dot --silent
```

Storybook browser-test tagged stories、`apps/web/.storybook-test/`、Storybook browser-test 設定を変更する場合のみ、追加で次を実行する。

```sh
pnpm --filter web test:storybook --reporter=dot --silent
```

## リスクと確認事項

- `category_budgets` を再導入するため DB / generated types / Web 型の更新範囲は広い。
- 設定画面では現在有効なカテゴリ別予算、支払い一覧では対象月のカテゴリ別予算を読むため、read shape の対象月を混同しない。
- `update_category_with_settings` の `p_budget_status` は文字列 enum として扱うため、不正値 check を DB 側に置く。
- `category_budgets` の member write policy は直接 table write も許可し得る。Web の通常経路は RPC に限定し、境界を閉じる必要がある箇所は RPC をテスト対象にする。
- カテゴリ削除は FK cascade に依存する。削除前に予算利用件数を表示する機能は対象外。
- スマホ 1 列表示は UI 密度が変わるため、実装後に visual / browser-level の確認が必要になる可能性がある。
