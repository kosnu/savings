# Design Doc: Show more の表示切り替え体験を改善する

## 概要

Requirements / PRD: `docs/ai-driven-development/workspaces/1438-show-more-toggle/requirements.md`

Issue #1438 では、カテゴリ別サマリーの `Show more` 操作を、追加表示操作として認識しやすく、押しやすく、展開後に元の表示量へ戻せるようにする。

今回の変更は `CategoryTotals` の UI 状態と表示だけを対象にする。カテゴリ別サマリーの取得、並び順、初期表示件数、ピン留め優先順、未分類行、DB / API / 認証 / 権限は変更しない。

## 現行実装

- `CategoryTotals` は `initialVisibleCount = 3` を持つ。
- 表示対象は `categoryTotals.slice(0, visibleCount)` で制限している。
- `hiddenCount > 0` の場合だけ `Show more` ボタンを表示している。
- `Show more` クリック時は `visibleCount` を `categoryTotals.length` にし、取得済み配列の残りを表示する。
- 展開後は `hiddenCount` が 0 になり、`Show more` ボタン自体が消える。
- `CategoryTotalsResolved` は対象月、`key`、`kind`、`totalAmount`、`pinned` を含む `key` で `CategoryTotalsContent` を remount し、月変更または集計結果変更時に表示状態を初期化している。
- `fetchCategoryTotals` は pinned な登録カテゴリ、unpinned な登録カテゴリ、未分類 `Unknown` の順に並べている。

## 採用する実装方針

### UI 状態

`CategoryTotalsContent` 内の `visibleCount` state を維持し、展開状態を次の派生値で判断する。

- `hasOverflow = categoryTotals.length > initialVisibleCount`
- `isExpanded = visibleCount >= categoryTotals.length`
- `visibleTotals = categoryTotals.slice(0, visibleCount)`

ボタンは `hasOverflow` の場合だけ表示する。これにより、カテゴリ別サマリーが 3 件以下の場合は追加表示 / 折りたたみ操作を表示しない。

ボタン操作:

- `isExpanded === false` のとき、クリックで `visibleCount` を `categoryTotals.length` にする。
- `isExpanded === true` のとき、クリックで `visibleCount` を `initialVisibleCount` に戻す。

この方針により、追加表示は既存どおり追加 network request ではなく、取得済み配列の表示範囲を切り替える操作になる。

### 表示文言とアクセシブルな名前

主要文言は Design Doc で次のとおり決める。

- 折りたたみ状態の表示ラベル: `Show more`
- 折りたたみ状態の `aria-label`: `Show more category totals`
- 展開状態の表示ラベル: `Show less`
- 展開状態の `aria-label`: `Show less category totals`

`Show less` は、展開後に元の表示量へ戻す操作として短く、既存の英語 UI 文言とも揃う。

### 視覚的優先度と押しやすさ

`Show more` / `Show less` は状態表示ではなく操作要素として扱う。ただし、バッジなどの状態表示要素と見間違わないよう、既存の `variant="soft"` から低優先度のボタン表現へ変更する。

採用方針:

- Radix Themes の `Button` を継続して使う。
- `variant="ghost"` を使い、状態表示の `Badge` と見分けやすい操作要素にする。
- `color="gray"` を使い、カテゴリやピン状態を示すバッジより視覚的優先度を上げすぎない。
- `size="2"` を使い、現行の `size="1"` よりタッチ操作しやすくする。
- ボタンの配置はカテゴリ別サマリー全体の下に置き、`Flex justify="center"` で中央寄せにする。

中央寄せは、カテゴリ別サマリーの一部の値や左端の小要素ではなく、一覧の追加表示 / 折りたたみ操作として認識しやすくするために採用する。これはカテゴリ別サマリーのデータ行やバッジとは別の操作領域として扱うためであり、表示データや並び順は変更しない。

### 既存 reset 挙動

`CategoryTotalsResolved` の `categoryTotalsKey` による remount 方針は維持する。

- 月変更時は `targetMonthKey` が変わり、`visibleCount` は初期値へ戻る。
- 集計結果変更時は `key` / `kind` / `totalAmount` / `pinned` を含む key が変わり、`visibleCount` は初期値へ戻る。

折りたたみ操作を追加しても、この reset 方針は変えない。

### コンポーネント構造

新しいコンポーネントは追加しない。`CategoryTotalsContent` 内の既存ボタン表示を toggle 表示へ変更する。

そのため、`apps/web/docs/policies/component-structure.md` の新規コンポーネントディレクトリ作成ルールは発動しない。もし Build / Verify でボタン部分を別コンポーネントへ切り出す必要が出た場合は、単体ファイルではなく `CategoryTotals` と同じ feature slice 内の兄弟コンポーネントディレクトリとして作成する。

## 変更対象ファイル・モジュール

### Web

- `apps/web/src/features/summaryByMonth/CategoryTotals/CategoryTotals.tsx`
  - `hiddenCount > 0` の単方向表示から、`hasOverflow` / `isExpanded` による toggle 表示へ変更する。
  - `Show more` / `Show less` の表示ラベルと `aria-label` を状態に応じて切り替える。
  - ボタンを `variant="ghost"`, `color="gray"`, `size="2"` にし、中央寄せにする。

- `apps/web/src/features/summaryByMonth/CategoryTotals/CategoryTotals.test.tsx`
  - `Show more` クリック後に `Show less` が表示されることを確認する。
  - `Show less` クリック後に初期表示へ戻ることを確認する。
  - 3 件以下では追加表示 / 折りたたみ操作が表示されないことを維持確認する。
  - ピン留め優先順と未分類行の既存確認を維持する。

### 変更しないファイル

- `apps/web/src/features/summaryByMonth/CategoryTotals/fetchCategoryTotals.ts`
  - 取得、集計、並び順は変更しない。
- `apps/web/src/features/summaryByMonth/Summary/Summary.tsx`
  - `CategoryTotals` の呼び出し構造は変更しない。
- DB / API / 認証 / 権限関連ファイル
  - 今回のスコープ外。

## 採用しない案

- `Show more` 後にボタンを消す現行案は採用しない。
  - 展開後に元の表示量へ戻せず、PRD の FR-2 / AC-5 / AC-6 を満たせないため。

- `variant="soft"` のまま維持する案は採用しない。
  - バッジなどの状態表示要素と見間違わない視覚表現にする要求があり、現行の soft button は状態表示要素に近く見えやすいため。

- `Badge` や `Text` をクリック可能にする案は採用しない。
  - 操作要素としての意味、キーボード操作、アクセシブルな名前を明確に保つため、Radix Themes の `Button` を使う。

- サーバーから追加取得するページング案は採用しない。
  - PRD の対象外であり、既存の「取得済みデータの表示範囲を広げる」挙動を不要に変えるため。

- 初期表示件数やカテゴリ別サマリーの並び順を変更する案は採用しない。
  - PRD の対象外であり、ピン留め優先順や未分類行の既存仕様に影響するため。

## 既存挙動への影響

- 4 件以上のカテゴリ別サマリーがある場合:
  - 初期表示は既存どおり最大 3 件。
  - `Show more` で全件表示する。
  - 展開後は `Show less` で最大 3 件表示へ戻せる。

- 3 件以下のカテゴリ別サマリーがある場合:
  - 既存どおり全件を表示し、追加表示 / 折りたたみ操作は表示しない。

- 月変更または集計結果変更時:
  - 既存どおり `CategoryTotalsContent` が remount され、表示量は初期表示件数へ戻る。

- カテゴリ別サマリーの取得、合計金額、並び順、ピン留め優先順、未分類 `Unknown` の扱い:
  - 変更しない。

## テスト方針

### `CategoryTotals.test.tsx`

- 既存の「カテゴリ別合計を表示する」テストを更新する。
  - 初期表示では `Unknown` が表示されないことを確認する。
  - `Show more category totals` ボタンをクリックする。
  - `Unknown` が表示されることを確認する。
  - `Show less category totals` ボタンが表示されることを確認する。
  - `Show less category totals` ボタンをクリックする。
  - `Unknown` が再び非表示になることを確認する。
  - `Show more category totals` ボタンが再表示されることを確認する。

- 既存の「3件以下の場合はShow moreを表示しない」テストを維持し、必要なら `Show less category totals` も表示されないことを確認する。

- 既存の「ピン留め優先順の先頭3件を初期表示する」テストを維持する。

- 必要なら、ボタンが `role="button"` として取得できることを確認し、バッジのような状態表示ではなく操作要素として存在することを押さえる。

### `fetchCategoryTotals.integration.test.ts`

変更しない。今回の要求は表示範囲と操作 UI の変更であり、取得、集計、並び順、ピン留め優先順は変更しないため。

## 受け入れ条件との対応

- AC-1, AC-2: `hasOverflow` の場合だけ中央寄せの `Button` を表示し、`size="2"` で押しやすさを確保する。
- AC-3: `Button variant="ghost" color="gray"` を採用し、`Badge` ではなく低優先度の操作要素として表示する。
- AC-4: `Show more` クリックで `visibleCount = categoryTotals.length` にする。
- AC-5, AC-6: 展開後に `Show less` を表示し、クリックで `visibleCount = initialVisibleCount` に戻す。
- AC-7: 表示ラベルと `aria-label` を `Show more category totals` / `Show less category totals` に切り替える。
- AC-8: `categoryTotals.length <= initialVisibleCount` の場合は操作ボタンを表示しない。
- AC-9: 表示範囲だけを切り替え、集計内容、並び順、ピン留め優先順は変更しない。
- AC-10: 追加取得は行わず、取得済み配列の slice 範囲だけを切り替える。
- AC-11: 既存の `categoryTotalsKey` remount 方針を維持する。
- AC-12: Radix Themes の `Button` と状態別 `aria-label` を使い、キーボード操作とスクリーンリーダー向けの操作名を維持する。

## リスクと確認事項

- `variant="ghost" color="gray"` は視覚的優先度を下げる一方で、弱すぎると操作要素として見落とされる可能性がある。
  - Build / Verify では Storybook または画面表示で、操作要素として認識できることを目視確認する。
- 中央寄せにより既存のカテゴリ別サマリー layout と余白感が変わる。
  - Build / Verify では狭い画面幅でもボタンが押しにくくならないことを確認する。
- UI の見た目はユニットテストだけでは十分に検証できない。
  - テストでは状態遷移とアクセシブルな操作名を確認し、視覚的優先度とバッジ誤認防止は Storybook / ブラウザ確認の対象にする。

## Build / Verify Goal への入力

- 実装対象:
  - `apps/web/src/features/summaryByMonth/CategoryTotals/CategoryTotals.tsx`
  - `apps/web/src/features/summaryByMonth/CategoryTotals/CategoryTotals.test.tsx`
- 守ること:
  - 初期表示件数は 3 件のままにする。
  - 取得、集計、並び順、ピン留め優先順、未分類行は変更しない。
  - 追加 network request を発生させない。
  - 主要文言と aria-label は Design Doc の決定に従う。
  - 新規依存は追加しない。
- Verification:
  - `pnpm run web:lint`
  - `pnpm run web:format-check`
  - `pnpm run web:typecheck`
  - `pnpm --filter web exec vp test run --project unit --project integration --reporter=dot --silent`
