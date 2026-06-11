# Design Doc: 月予算テーブルの構造を「予算なし」状態に対応させる

## 概要

Requirements / PRD: `docs/ai-driven-development/workspaces/1411-monthly-budget-table-structure/requirements.md`

現行の月予算は `monthly_budgets` の `effective_from` が対象月末日以前で最新の 1 件を有効予算として扱う。この方式では、最新レコードを削除すると過去予算が復活し、当月の予算更新でも過去月の表示を上書きしてしまう。

`monthly_budgets` を「月ごとの予算状態イベント」として拡張し、金額あり状態と予算なし状態を同じ時系列で扱う。既存レコードは金額あり状態として移行し、予算なしは `amount` ではなく状態で表現する。作成、更新、削除/無効化は直接 table 操作ではなく RPC に寄せ、操作月より前の月を変更しない境界を DB transaction 内で担保する。

## 採用する実装方針

### DB 構造

- `monthly_budgets` に `status text not null default 'amount'` を追加する。
  - 許容値は `amount` / `none` とする。
  - 既存レコードは default により `amount` として扱う。
- `amount` は nullable に変更する。
  - `status = 'amount'` の場合は `amount is not null`。
  - `status = 'none'` の場合は `amount is null`。
  - 0 円予算は `status = 'amount'` かつ `amount = 0` として表現し、予算なしと区別する。
- 既存の `book_id, effective_year, effective_month` unique は維持する。
  - 同一 Book・同一年・同月に、金額あり状態と予算なし状態を重複登録しない。
  - 予算なし状態がある月に金額あり予算を作成する場合は、同じ月の行を `status = 'amount'` に置き換える。
- `idx_monthly_budgets_book_effective_from` は有効状態取得の主 index として維持する。
- `docs/harness/domain/monthly-budget.md` は、最新 1 件の金額レコードではなく、最新 1 件の月予算状態イベントで有効状態を決めるルールへ更新する。

### 読み取り境界

- 有効月予算取得は `get_effective_monthly_budget(p_target_month date)` RPC に置き換える。
  - `p_target_month` は対象月内の日付を受け取り、DB 側で対象月末日へ正規化する。
  - 対象 Book は認証ユーザーの default book を使う。
  - 対象月末日以前の `monthly_budgets` を `effective_from desc limit 1` で取得する。
  - 最新状態が `amount` なら、金額ありの DTO を返す。
  - 最新状態が `none` なら、予算なしの DTO を返す。
  - 該当行がない場合は、未設定の DTO を返す。
- Web の戻り値は `MonthlyBudgetState` として扱う。
  - `status: "amount" | "none" | "unset"`
  - `monthlyBudget: MonthlyBudget | null`
  - 金額あり以外では `amount` を参照しない。
- 月次合計・サマリーは `status = "amount"` の場合だけ残額/超過額を表示する。
  - `none` と `unset` はどちらも予算差分を表示しない。
  - UI 表示は初期実装では同じ扱いにし、追加文言は増やさない。

### 作成境界

- 月予算作成は `create_monthly_budget(p_effective_month date, p_amount integer)` RPC に置き換える。
- RPC は次を DB transaction 内で行う。
  - `p_effective_month` を月初日に正規化する。
  - 操作月より前の月なら例外にする。
  - 同じ Book・同じ年月に `status = 'none'` の行があれば、`status = 'amount'`、`amount = p_amount` に更新する。
  - 同じ Book・同じ年月に `status = 'amount'` の行があれば、既存の重複月予算エラーとして扱う。
  - 同じ年月の行がなければ `status = 'amount'` で insert する。
- Web の `CreateMonthlyBudgetForm` は過去月を選べないようにし、DB エラー時も専用文言を表示できるようにする。

### 更新境界

- 月予算更新は `update_current_monthly_budget(p_amount integer)` RPC に置き換える。
- RPC は操作月の有効状態を DB 側で判定する。
  - 操作月に有効な最新状態が `amount` でなければ例外にする。
  - 操作月と同じ年月の `status = 'amount'` 行があれば、その行の `amount` を更新する。
  - 操作月より前から有効な `status = 'amount'` 行が最新状態の場合、操作月の月初日に新しい `status = 'amount'` 行を insert する。
- これにより、2026/10/01 に 2026/09 から有効な 90,000 円予算を 100,000 円へ更新しても、2026/09 の表示は 90,000 円のまま維持し、2026/10 以降だけ 100,000 円になる。
- Web の編集 UI は「最新予算レコードの編集」ではなく「This month の有効予算更新」として扱う。

### 削除 / 無効化境界

- ユーザー操作は `Remove budget` と表示し、内部実装は物理削除ではなく `none` 状態の追加または置換とする。
- RPC は `remove_current_monthly_budget()` を追加する。
  - 操作月に有効な最新状態が `amount` でなければ例外にする。
  - 操作月と同じ年月の `status = 'amount'` 行があれば、その行を `status = 'none'`, `amount = null` に更新する。
  - 操作月より前から有効な `status = 'amount'` 行が最新状態の場合、操作月の月初日に `status = 'none'`, `amount = null` 行を insert する。
  - 物理削除は行わない。
- 2026/10/01 に 2026/09 から有効な 90,000 円予算を削除/無効化した場合、2026/10 は `none`、2026/09 は 90,000 円のまま閲覧できる。

### 権限・RPC

- 新規 RPC は `security invoker set search_path = public` とする。
- `authenticated` と `service_role` に execute grant し、`public` / `anon` から revoke する。
- Book 境界は既存の `get_authenticated_default_book_id()` と `book_members` 前提を維持する。
- 直接 table insert / update / delete では操作月制約や状態遷移を担保しづらいため、Web は月予算の write を RPC 経由へ移す。
- delete policy は追加しない。物理削除をユーザー操作にしないため不要。

## 変更対象ファイル・モジュール

### API / DB

- `apps/api/supabase/migrations/<timestamp>_add_monthly_budget_states.sql`
  - `monthly_budgets.status` 追加。
  - `amount` nullable 化。
  - `status` / `amount` 整合 check 追加。
  - `get_effective_monthly_budget` RPC 追加。
  - `create_monthly_budget` RPC 追加。
  - `update_current_monthly_budget` RPC 追加。
  - `remove_current_monthly_budget` RPC 追加。
  - grant / revoke 追加。
- `apps/web/src/types/database.types.ts`
  - `monthly_budgets.status` と RPC 型を同期する。
- `docs/harness/domain/monthly-budget.md`
  - 有効月予算の判定ルール、予算なし、操作月以降の更新/無効化を反映する。

### Web

- `apps/web/src/features/budgets/types/index.ts`
  - `MonthlyBudget.status` または `MonthlyBudgetState` を追加する。
- `apps/web/src/features/budgets/monthlyBudgetMappers.ts`
  - `status` と `amount nullable` を正規化する。
- `apps/web/src/features/budgets/getMonthlyBudget/`
  - REST 直接取得から `get_effective_monthly_budget` RPC へ置き換える。
- `apps/web/src/features/budgets/createMonthlyBudget/`
  - create RPC へ置き換える。
  - 過去月選択のバリデーションとエラー文言を追加する。
- `apps/web/src/features/budgets/updateMonthlyBudget/`
  - update RPC へ置き換え、月予算 ID ではなく当月有効予算を更新する。
- `apps/web/src/features/budgets/removeMonthlyBudget/`
  - 新規追加。`remove_current_monthly_budget` RPC、hook、modal/form を置く。
- `apps/web/src/features/budgets/latestMonthlyBudget/LatestMonthlyBudget/`
  - 現在有効な月予算状態を表示する。
  - `amount` の場合は Edit / Remove を表示する。
  - `none` / `unset` の場合は Create を表示する。
- `apps/web/src/features/budgets/listMonthlyBudget/`
  - 一覧は `status = 'amount'` の行だけを表示する。
  - 予算なし marker を履歴表示として見せる機能は追加しない。
- `apps/web/src/features/summaryByMonth/MonthlyTotals/` と `MonthlyBudgetUsage`
  - `status = 'amount'` の場合だけ予算差分を計算する。
- `apps/web/src/test/msw/handlers/monthlyBudgets.ts`
  - RPC と `status` 付きレスポンスへ対応する。

## 採用しない案

- 既存の最新 `monthly_budgets` 行を物理削除する案は採用しない。過去予算が復活し、PRD の AC-1 / AC-2 を満たせない。
- 既存の `amount` を 0 にして予算なしを表現する案は採用しない。0 円予算と予算なしを区別できず、AC-6 を満たせない。
- `monthly_budgets.amount` を nullable にするだけの案は採用しない。NULL の意味が未設定、削除、予算なしのどれか曖昧になるため。
- 既存の月予算レコードを直接 update して当月予算を変更する案は採用しない。2026/09 の 90,000 円が 2026/10 の更新で 100,000 円に変わり、AC-9 を満たせない。
- `effective_to` だけを追加する案は採用しない。予算なし状態を明示できず、次の予算が登録されるまで「なし」を維持する判定が複雑になる。
- 別テーブル `monthly_budget_events` を新設して現行 `monthly_budgets` と二重管理する案は採用しない。意味は明確だが、既存の table / 型 / UI が広く置き換わり、今回の範囲では `monthly_budgets` の状態拡張で十分に表現できる。
- Web 層だけで過去月登録や更新対象を制限する案は採用しない。直接 REST / RPC の呼び出しや競合時に制約が抜けるため、DB RPC 側にも境界を置く。
- 予算なしをユーザー向け履歴一覧に表示する案は採用しない。PRD では履歴表示や監査ログ機能の追加が対象外であり、既存一覧は金額あり予算の一覧として維持する。

## ユーザー向け主要文言

- 月予算作成ダイアログ:
  - title: `Create monthly budget`
  - description: `Set a monthly budget amount.`
  - 過去月エラー: `Month cannot be before the current month.`
  - 重複月エラー: `A monthly budget for this month already exists.`
  - 汎用作成エラー: `Failed to create monthly budget.`
- 月予算更新ダイアログ:
  - title: `Edit monthly budget`
  - description: `Update this month's budget amount.`
  - 汎用更新エラー: `Failed to update monthly budget.`
- 月予算削除/無効化ダイアログ:
  - trigger: `Remove budget`
  - title: `Remove this month's budget?`
  - description: `This month and future months will have no budget until you create a new one. Past months keep their budget history.`
  - confirm button: `Remove`
  - 汎用削除/無効化エラー: `Failed to remove monthly budget.`
- 月次合計の予算なし表示:
  - 追加文言は表示しない。既存の「予算がない場合は差額を表示しない」挙動を維持する。

## 既存挙動への影響

- 月次支出合計の計算は変更しない。
- 月予算差分は、金額あり予算がある月だけ表示する。
- 月予算が未設定または予算なしの月では、既存どおり差額表示を出さない。
- 月予算の作成・更新・削除/無効化後は `monthlyBudgetQueryKeys.listAll` と `monthlyBudgetQueryKeys.effectiveAll` を invalidate する。
- 作成フォームでは過去月を許可しなくなる。
- 更新は当月の有効予算に対する操作へ変わり、過去月の予算履歴を上書きしなくなる。
- 予算なし marker は既存の月予算一覧には表示しないため、一覧は金額あり予算の確認用途を維持する。

## 受け入れ条件とテスト方針

- AC-1 / AC-2: `remove_current_monthly_budget` RPC と `fetchEffectiveMonthlyBudget` の integration test で、予算なし marker 後に過去予算が復活しないことを確認する。
- AC-3: 2026/10 に remove しても 2026/09 の取得が 90,000 円を返すテストを追加する。
- AC-4: `MonthlyBudgetUsage` / `MonthlyTotals` で `status = none` または `unset` の場合に left / over を表示しないことを確認する。
- AC-5: none marker 後に同月または以降の新規予算を作成すると、その月以降の有効予算になることを RPC / mapper / UI テストで確認する。
- AC-6: `status = amount, amount = 0` と `status = none, amount = null` を mapper と usage test で区別する。
- AC-7: `LatestMonthlyBudget` で金額あり状態のときだけ Remove が表示され、none / unset では Create が表示されることを確認する。
- AC-8: create RPC と form validation で操作月より前の月を登録できないことを確認する。
- AC-9: 2026/10 に更新しても 2026/09 は更新前金額、2026/10 は更新後金額になることを RPC / fetch integration test で確認する。
- AC-10 / AC-11: migration 後に既存レコードが `status = amount` として扱われ、有効予算が変わらないことを migration review と mapper test で確認する。
- AC-12: create / update / remove の失敗時に既存の dialog を閉じず、専用エラー文言を表示する UI test を追加する。
- AC-13: 既存の月次合計、月予算作成、更新、一覧、カテゴリ関連テストを維持し、カテゴリ関連コードへ不要な変更を入れない。

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

- `monthly_budgets.amount` nullable 化により、既存 mapper / 型 / テストデータの更新漏れが起きやすい。`status = amount` のときだけ `amount` 必須にする正規化を明確にする。
- RPC 戻り値を nullable row ではなく discriminated union にするため、Supabase 型生成結果だけでは表現しきれない可能性がある。Web 側で zod 正規化を置く。
- 操作月の基準は DB の `current_date` で決める。ブラウザのタイムゾーンと DB 日付が月境界でずれる可能性は残るが、操作制約を DB 側で一貫させることを優先する。
- 既存の `fetchMonthlyBudgets(limit)` を金額あり一覧に維持するため、none marker を見せる履歴表示は追加しない。将来、状態履歴を表示したい場合は別要求にする。
- 現行の `monthly-budget.md` と実装が矛盾するため、Build / Verify では domain doc 更新を実装差分に含める。
