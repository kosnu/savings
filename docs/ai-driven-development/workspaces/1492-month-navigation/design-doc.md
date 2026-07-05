---
title: "Design Doc: 月単位画面で前月・翌月へ移動しやすくする"
doc_type: design
status: draft
area: repository
applies_to:
  - apps/web
topics:
  - ai-driven-development
  - design-doc
  - payments
  - summary
  - month-navigation
  - date
  - domain-ui
when_to_read:
  - Issue #1492 の月送り機能を実装するとき
  - MonthSelector の前月・翌月操作を確認するとき
---

# Design Doc: 月単位画面で前月・翌月へ移動しやすくする

## 入力

- Requirements / PRD: `docs/ai-driven-development/workspaces/1492-month-navigation/requirements.md`
- 対象 Issue: #1492
- 対象画面: `/payments`
- 出力対象: この Design Doc

`requirements.md` は read-only 入力として扱う。Design / Plan の都合で追記、修正、整形、リネームしない。

## 要約

`/payments` の月次サマリー内にある `MonthSelector` に、前月・翌月へ移動する icon-only 操作を追加する。既存の `MonthPicker` による任意年月選択は維持し、前月・翌月操作も同じ `year` / `month` search params を更新する。

月送り操作は `navigate({ to: "/payments", search: (prev) => ({ ...prev, year, month }) })` の既存更新パターンを使い、`category` など月以外の検索条件を保持する。支払い、カテゴリ、月次予算、集計ロジック、DB/API/Auth/RLS/RPC は変更しない。

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- Classification:
  - path: `apps/web/src/features/summaryByMonth/MonthSelector`, `docs/ai-driven-development/workspaces/1492-month-navigation/design-doc.md`
  - domain: `date`, `payment`, `monthly-budget`, `web-ui`
  - activity: `write_design_doc`, `change_month_scope`, `change_domain_ui`, `add_test`
  - topic: `design-doc`, `month`, `payments`, `summary`, `domain-ui`, `test`
- Selected:
  - `ai-driven.workflow`: Design 工程の責務と generated artifact read-only 境界を守るため。
  - `domain.date`: 対象月を年と月で扱い、年またぎを月演算で扱うため。
  - `policy.temporal-data`: UI の対象月変更と read 側の月次状態を混同しないため。
  - `domain.payment`: 月次支出合計の対象月境界を変えないため。
  - `domain.monthly-budget`: 月次予算の対象月、予算なし、未設定、差分の意味を変えないため。
  - `web.domain-ui-rules`: Domain Value UI Decisions を Requirements の目的に対応させるため。
  - `web.design-rules`: icon-only 操作、余白、responsive、操作の視覚階層を決めるため。
  - `web.component-structure`: コンポーネント追加や切り出しを避ける/行う場合の構造確認のため。
  - `web.test-policy`: ユーザーに残る挙動の回帰をテストするため。
- Depends-on:
  - `ai-driven.overview`: AI Driven Development の工程前提。
  - `ai-driven.issue-guidelines`: Issue / Requirements / Design の責務分離。
  - `domain.amount`: 月次合計、予算額、残額、超過額の意味を変えないため。
  - `domain.category`: カテゴリ条件を維持するため。
  - `web.design-system-brand`: Savings の UI トーンを保つため。
- Conflict decision: none.

## 現行実装

- `PaymentsPage` は `Summary`、`PaymentCategoryFilter`、`PaymentList` を同じ `/payments` 画面に表示している。
- `useInitializePaymentsMonthSearch` は `/payments` 配下で `year` / `month` が不足している場合、認証済みユーザーに現在年月を補完する。
- `Summary` は `MonthSelector`、`MonthlyTotals`、`CategoryTotals` を表示する。
- `MonthSelector` は `year` / `month` search params から `currentDate` を作り、`MonthPicker` で任意年月を選ぶと `/payments` の search params を更新する。
- `MonthSelector.test.tsx` は、年月表示、年月選択時の search params 更新、カテゴリ条件保持を確認している。

## 採用方針

### 変更対象

- `apps/web/src/features/summaryByMonth/MonthSelector/MonthSelector.tsx`
- `apps/web/src/features/summaryByMonth/MonthSelector/MonthSelector.test.tsx`

新しいコンポーネントディレクトリは作らない。今回の UI は既存 `MonthSelector` の操作追加で表現できるため、`web.component-structure` に関わる新規切り出しは不要である。

### UI 構成

`MonthSelector` の中で、既存 `MonthPicker` の左右に前月・翌月の icon-only `IconButton` を置く。

- 前月操作: `IconButton` + `ChevronLeftIcon`
- 任意年月選択: 既存 `MonthPicker`
- 翌月操作: `IconButton` + `ChevronRightIcon`

Radix Themes の `Flex` で `align="center"`、`gap="2"` を使い、既存 `MonthPicker` の密度を保つ。icon-only 操作は低優先度のナビゲーション操作なので `variant="ghost"`、`size="2"` を基本にする。独自色、独自 shadow、固定 px の追加はしない。

主要文言とアクセシブルな名前:

- 前月操作: `aria-label="Previous month"`
- 翌月操作: `aria-label="Next month"`

画面上の可視テキストは増やさない。対象月の識別は既存 `MonthPicker` の Year / Month 表示で担う。

### 対象月更新

`MonthSelector` 内で、現在の対象月から1か月前/後の `Date` を作る小さな helper を置く。

- 前月: `new Date(year, monthIndex - 1, 1)`
- 翌月: `new Date(year, monthIndex + 1, 1)`

JavaScript の month rollover を使い、2026年1月から前月は2025年12月、2025年12月から翌月は2026年1月になるようにする。

更新処理は既存 `handleMonthChange` と同じ経路に寄せる。最終的に `year` / `month` を文字列化し、`navigate({ to: "/payments", search: (prev) => ({ ...prev, year, month }) })` で更新する。これにより `category` など月以外の search params を保持する。

`currentDate` がない場合は、既存の `useInitializePaymentsMonthSearch` が補完する前提を維持する。防御的に操作された場合の基準月は実行時現在月とし、Requirements にない新しい未選択状態や disabled 状態は導入しない。

### `/payments` 配下 URL の扱い

`MonthSelector` の既存年月選択は `to: "/payments"` へ遷移する。前月・翌月操作も同じ境界に合わせる。支払い詳細 overlay など `/payments` 配下で操作された場合も、既存の年月選択と同じく一覧 URL へ戻す。今回の Design では、支払い詳細を開いたまま月だけ変える新しい挙動は追加しない。

## Domain Value UI Decisions

| 値 | Requirements の目的 | 主に見せるもの | Design 判断 |
| --- | --- | --- | --- |
| target month | 何年何月の情報か識別したい | 識別情報 | 既存 `MonthPicker` の Year / Month 表示を主表示にする。 |
| previous month / next month | 隣接月へ移動したい | 操作 | icon-only `IconButton` で操作として表示し、aria-label で操作名を明示する。 |
| payment list | 対象月の明細を確認したい | 内訳 | 月送りは search params だけを変え、既存 `PaymentList` の取得境界に任せる。 |
| monthly total amount | 対象月の支出合計を知りたい | 値 | 月送りは既存 `MonthlyTotals` の対象月変更を引き起こすだけで表示ルールは変えない。 |
| monthly budget state | 対象月の予算使用状況を確認したい | 状態/判断結果 | 予算なし、未設定、残額/超過の意味は既存表示に任せる。 |
| remaining / exceeded amount | 予算に対する残額/超過を判断したい | 判断結果 | 差分表示の意味と階層は変えない。 |
| category filter | 月以外の条件を保持したい | 状態 | `search: (prev) => ({ ...prev, year, month })` で category を保持する。 |
| category totals | 対象月のカテゴリ別合計を確認したい | 内訳 | 月送りは対象月変更だけを行い、集計・並び順は変えない。 |

## 採用しない案

- `MonthPicker` を前月・翌月ボタンだけに置き換える: 任意年月選択を維持する Requirements に反するため採用しない。
- `MonthPicker` 自体を変更して月送り機能を持たせる: 予算作成フォームなど他用途へ影響が広がるため採用しない。
- URL search params 以外の状態を追加する: `/payments` の対象月 source of truth が分散するため採用しない。
- 月送り時に category を解除する: 月以外の既存条件を壊さない Requirements に反するため採用しない。
- 支払い詳細を開いたまま月だけ変える: 既存 `MonthSelector` の遷移境界を超える新しいプロダクト判断になるため採用しない。

## 既存挙動への影響

- 任意年月選択は維持する。
- `year` / `month` search params の意味は変えない。
- `category` search param は保持する。
- 月次支出合計、月次カテゴリ別合計、月次予算使用状況の計算ルールは変えない。
- 支払い、カテゴリ、月次予算の作成/更新/削除、保存可否は変えない。
- 新規依存は追加しない。既存の `@radix-ui/react-icons` と `@radix-ui/themes` を使う。

## テスト方針

`MonthSelector.test.tsx` を中心に、ユーザー操作で残る挙動を確認する。

- AC-1 / AC-8: 既存テストで、search params の年月が表示され、MonthPicker で任意年月を選べることを維持する。
- AC-2: `Previous month` をクリックすると `year` / `month` が1か月前へ変わる。
- AC-3: `/payments?year=2026&month=1` で `Previous month` をクリックすると `2025` / `12` になる。
- AC-4: `Next month` をクリックすると `year` / `month` が1か月後へ変わる。
- AC-5: `/payments?year=2025&month=12` で `Next month` をクリックすると `2026` / `1` になる。
- AC-6: `MonthSelector` が search params を更新することで、対象月依存表示は既存の `/payments` 取得境界に従う。Build / Verify で統合不具合が見つからない限り、追加の `PaymentsPage` テストは不要とする。
- AC-7: `/payments?year=2025&month=5&category=10` で前月または翌月へ移動しても `category` が保持される。
- AC-9: 月送り操作は `year` / `month` search params の更新に閉じるため、データ構造や集計ロジックを変えるテストは追加しない。実装 diff review で対象外変更がないことを確認する。
- AC-10: UI 形状、component、文言はこの Design Doc で決定し、Requirements に追記しない。Build / Verify では Design Doc の決定に沿った実装になっていることを確認する。

`PaymentsPage.test.tsx` に広げる必要はない。`MonthSelector` が search params を正しく更新すれば、既存の `/payments` 取得境界と表示更新は既存テストの責務で確認済みである。Build / Verify で実装後に意図しない結合不具合が見つかった場合のみ、影響範囲に応じて追加する。

## Build / Verify への入力

- `MonthSelector.tsx` に `IconButton`, `Flex`, `ChevronLeftIcon`, `ChevronRightIcon` を追加する。
- 既存 `handleMonthChange` の経路を再利用できる形で前後月移動 handler を追加する。
- icon-only button には `aria-label="Previous month"` / `aria-label="Next month"` を付ける。
- `MonthSelector.test.tsx` に前月、翌月、年またぎ、category 保持のテストを追加する。
- Web アプリケーションコード変更なので、Build / Verify では AGENTS.md の Web verification batch を実行する。Storybook browser-test は、browser-test tagged stories、`.storybook-test`、Storybook browser-test config を変更しない限り不要。

## リスクと確認事項

- `MonthPicker` の `YEARS` は2022年から2032年までの選択肢だが、前月・翌月操作は `Date` rollover によりその範囲外の年月も作れる。Requirements は月選択範囲を変更する要求ではないため、Build / Verify で実装時に既存 MonthPicker 表示との整合が崩れる場合は Stop する。
- `/payments/details/...` での操作は既存 `MonthSelector` と同じく `/payments` へ戻る設計にした。詳細を開いたまま対象月だけ変える必要が出た場合は Requirements にない挙動なので Stop する。
- 前月/翌月操作の見た目が狭い画面で折り返す可能性はあるが、既存 `Summary` は `wrap="wrap"` を持つ。Build / Verify で表示崩れが明らかな場合は既存 Radix props の範囲で調整し、別レイアウト判断が必要なら Stop する。

## Verification

この Design Doc 作成は documentation-only であり、アプリケーションの format / lint / typecheck / test は不要である。確認対象は Requirements / PRD、選択した rule-map subgraph、Stop 条件との整合である。

## Rule / Policy Check

- Requirements の対象外である DB/API/Auth/RLS/RPC、データ構造、集計ロジック、新規依存、月以外の期間単位は追加していない。
- `requirements.md` は read-only 入力として扱い、変更しない。
- `web.design-rules` の icon-only 操作には aria-label を付ける。
- `web.domain-ui-rules` に沿って、対象月、支払い、予算、カテゴリ条件の UI 目的を Domain Value UI Decisions に対応付けた。
- `web.component-structure` に反する新規単体コンポーネント追加はしない方針にした。

## Stop 条件

- 実装時に `MonthPicker` の year range と前後月移動の整合が Requirements の範囲で解決できない。
- 支払い詳細を開いたまま月だけ変える必要がある。
- category 以外の search params を含む保持ルールで Requirements にない判断が必要になる。
- DB/API/Auth/RLS/RPC、データ構造、集計ロジック、新規依存、月以外の期間単位への拡張が必要になる。
- `requirements.md` の修正が必要になる。
- Design または実装方針が選択したルールやポリシーに違反する、または違反の可能性がある。
