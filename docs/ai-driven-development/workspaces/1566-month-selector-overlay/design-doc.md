---
title: "Design Doc: 支払い画面の年月選択をオーバーレイ式にする"
doc_type: design
status: draft
area: repository
applies_to:
  - apps/web
topics:
  - ai-driven-development
  - design-doc
  - payments
  - month-selector
  - dialog
  - accessibility
when_to_read:
  - Issue #1566 の年月選択改善を実装するとき
  - MonthSelector のdialogとfocus境界を確認するとき
---

# Design Doc: 支払い画面の年月選択をオーバーレイ式にする

## 入力

- Cycle ID: `issue-1566-month-selector-overlay-20260730-01`
- Requirements / PRD: `docs/ai-driven-development/workspaces/1566-month-selector-overlay/requirements.md`
- Issue: #1566
- 関連 Issue: #1492
- 対象画面: `/payments`

`requirements.md` はread-only入力として扱う。Design / Planの都合で追記、修正、整形、リネームしない。

## 要約

`MonthSelector` の前月・翌月ボタンの間に常時表示している `MonthPicker` を、locale-awareな現在年月を表示する1つのghost buttonへ置き換える。このbuttonをRadix Themesの `Dialog.Trigger` とし、開いたcentered dialog内に既存 `MonthPicker` を表示する。

`MonthPicker` には省略可能な `size` propを追加し、dialog内だけ `size="3"` を指定する。defaultは変えないため、支払い画面以外の既存利用箇所には表示・操作の変更を波及させない。

年または月を選んだときは、現行の `handleMonthChange` と `navigate` をそのまま利用して `year` / `month` search paramsへ即時反映する。保存/確定button、一時的な対象月state、自動closeは追加しない。dialogは明示的なclose icon、Escape、outside clickで閉じられ、RadixのTrigger/Content focus管理により元の年月buttonへfocusを戻す。

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- Classification:
  - path: `apps/web/src/features/summaryByMonth/MonthSelector`, `apps/web/src/components/inputs/MonthPicker`, `apps/web/src/i18n/resources.ts`, `docs/ai-driven-development/workspaces/1566-month-selector-overlay/design-doc.md`
  - domain: `date`, `payment`, `category`, `web-ui`, `test`
  - activity: `write_design_doc`, `change_payment_ui`, `change_dialog`, `change_component`, `add_test`
  - topic: `design-doc`, `month`, `payments`, `dialog`, `focus`, `i18n`, `test`
- Selected:
  - `ai-driven.workflow`: Design責務とRequirements read-only境界を守るため。
  - `documentation.policy`: canonical Design Docの形式を守るため。
  - `web.design-system-brand`: 通常画面の情報量を抑え、dialogだけに奥行きを持たせるため。
  - `web.design-rules`: current stateをbuttonで表し、centered dialog、title、close、focus、size、responsiveを既存tokensで設計するため。
  - `web.domain-ui-rules`: 対象年月を識別情報かつ検索条件として扱うため。
  - `web.component-structure`: Dialog操作境界を既存 `MonthSelector` が所有し、新しい薄いcomponentを増やさない判断のため。
  - `web.test-policy`: ユーザーに残る表示・操作・focus・URL状態を回帰テストするため。
  - `domain.payment`: 支払い画面と月次支出の対象月境界を変更しないため。
- Depends-on:
  - `ai-driven.overview`: AIDD工程の前提。
  - `domain.date`: 対象月を年と月の組み合わせで扱う前提。
  - `domain.amount`: 月次支出値の意味を変えない前提。
  - `domain.category`: category search条件の意味を変えない前提。
- Conflict decision: none.

## Domain Value UI Decisions

| 値 | 利用目的 | 主表示・操作 | 状態と制約 |
| --- | --- | --- | --- |
| 現在の対象年月 | 表示中の支払いと月次サマリーの対象を識別する | 通常時は値そのものをlocale-awareな1つのbutton labelとして表示する | URLに値がない初期化前だけ「Select year and month / 年月を選択」をfallback表示する |
| 年・月の選択値 | 支払い画面の検索条件を選ぶ | dialog内で年と月を独立した大きいselectとして表示する | 現行範囲2022-01〜2032-12、未選択/不正値の新しい状態は追加しない |
| `year` / `month` | 対象月のsource of truth | 選択ごとに既存navigateで更新する | 別state、保存、確定、取消rollbackを追加しない |
| `category` | 支払い一覧の分類条件を維持する | 年月UIでは表示しない | `search: (prev) => ({ ...prev, year, month })` で保持する |
| 前月・翌月 | 隣接月へ移動する | 現行icon-only ghost buttonsを維持する | 年またぎ、上下限、category保持を変更しない |

## 変更対象

### `MonthSelector.tsx`

- `Dialog`, `Button`, `Cross1Icon` を追加し、既存 `Flex` / `IconButton` と組み合わせる。
- `useTranslation()` から `i18n.resolvedLanguage` を参照し、`getDateLocale` と `Intl.DateTimeFormat` で現在年月を1つの文字列へformatする。
  - English: `May 2025`
  - Japanese: `2025年5月`
- `currentDate` がまだない場合は新規i18n key `date.selectYearMonth` をfallback labelに使う。
- 前月buttonと翌月buttonの間に次のDialog構造を置く。
  - `Dialog.Root`: uncontrolledでopenを管理する。
  - `Dialog.Trigger`: `Button type="button" variant="ghost" size="3"`。visible labelは現在年月。
  - `Dialog.Content`: default centered dialog。独自CSS、独自shadow、全画面sheetを追加しない。
  - `Dialog.Title`: `date.selectYearMonth`。
  - `Dialog.Close`: `IconButton variant="ghost"` と `Cross1Icon`。accessible nameは `common.close` にdialog titleを渡す。
  - `MonthPicker`: `value={currentDate ?? undefined}`, `onChange={handleMonthChange}`, `size="3"`。
- title/closeを同じ上段に置き、`MonthPicker` は標準の `space-4` 相当を空けて中央に置く。Radix propsだけを使い、CSS moduleは追加しない。
- `handleMonthChange`、前月/翌月handler、上下限判定、navigateは変更しない。
- 年/月選択でdialogを自動closeしない。年または月の一方を変えたあと、もう一方も続けて変更できるようにする。
- Dialogの既定dismiss（明示close、Escape、outside click）とfocus restorationを利用する。独自refや `onCloseAutoFocus` は追加しない。

### `MonthPicker.tsx`

- propsへoptional `size` を追加する。型は `ComponentProps<typeof Select.Root>["size"]` 相当を使い、Radixの許可値に追従させる。
- 年と月の両方の `Select.Root` へ同じ `size` を渡す。
- `size` 未指定時のdefaultを維持し、既存利用箇所へ変更を波及させない。
- value計算、選択範囲、`onChange`、月名formatは変更しない。

### `resources.ts`

- `date.selectYearMonth` を英日双方へ追加する。
  - English: `Select year and month`
  - Japanese: `年月を選択`
- close labelは既存 `common.close` を再利用する。

### Tests / Stories

- `MonthSelector.test.tsx` を新しいdialog操作に合わせて更新する。
- router stateを年月・categoryごとに直接検証するため、Storyを再利用せずtest routerへ直接mountする理由をhelper付近のコメントに残す。
- `MonthPicker.stories.tsx` に `Large` story（`size: "3"`）を追加し、dialog内サイズを単体確認できるようにする。
- `MonthPicker.test.tsx` は既存のdefault API回帰を維持する。sizeを内部class/data属性で固定するunit testは追加しない。
- `MonthSelector.stories.tsx` は既存 `Default` storyから年月triggerとdialogを手動確認できるため、新しいStoryや`browser-test` tagは追加しない。

## 主要文言

| 用途 | English | Japanese |
| --- | --- | --- |
| dialog title / 初期化前trigger | Select year and month | 年月を選択 |
| close aria-label | Close Select year and month | 年月を選択を閉じる |
| year select | Year | 年 |
| month select | Month | 月 |
| 前月 / 翌月 | Previous month / Next month | 前月 / 翌月 |

closeの日本語は既存 `common.close` の文型をそのまま使用し、このtaskで共通文言を変更しない。

## 採用しない案

### 共通 `MonthPicker` のdefault sizeを大きくする

支払い画面以外の予算フォームとcomponent storyへ表示変更が波及し、AC-9に反するため採用しない。optional propでdialog内だけを大きくする。

### `MonthSelector` 専用の年/月selectを新規実装する

既存 `MonthPicker` の選択範囲、locale月名、即時 `onChange` を重複させるため採用しない。必要な差はsize propに限定する。

### 新しい `MonthSelectorDialog` componentへ切り出す

Dialogのopen/focusと対象月navigateは `MonthSelector` の1つの操作責務であり、独立したdata/state境界がない。薄いwrapperを増やすだけになるため採用しない。実装時に別責務が判明した場合はcomponent-structure policyとStop条件を再確認する。

### 保存/確定buttonを追加する

Requirementsは既存の即時反映を維持し、別stateやconfirm操作を要求していないため採用しない。

### mobileを全画面sheetにする

短い年/月選択であり、IssueとRequirementsはcentered dialogを求めている。新しいresponsive操作判断になるため採用しない。selectが狭幅で操作可能なことだけを確認する。

## 既存挙動への影響

- 変更するのは `/payments` の任意年月選択の通常表示と一時面だけである。
- `year` / `month` search params、category保持、対象月依存query、選択可能範囲、前月/翌月は既存処理を再利用する。
- `MonthPicker` のdefaultは変えないため、月次予算作成fieldを含む他利用箇所の表示・操作は変わらない。
- new dialogはclient-side UIだけで、API request、cache key、DB、Auth、RLS、RPCへ影響しない。

## 受け入れ条件とテスト方針

| AC | 永続テスト / 確認 |
| --- | --- |
| AC-1 | `MonthSelector.test.tsx`: `May 2025`という1つのbuttonが見え、通常時にYear/Month comboboxがない |
| AC-2 | trigger click後、`Select year and month`というdialogとYear/Month comboboxが見える |
| AC-3 | `MonthPicker`へ`size="3"`を渡す実装reviewと`Large` storyで確認。visual checkでdefaultとの差と狭幅操作を確認 |
| AC-4 | dialogを開いて年/月を選び、routerの `year` / `month` とtrigger labelが更新されることを確認 |
| AC-5 | category付きURLでdialogから月を変え、category保持を確認 |
| AC-6 | close iconでdialogを閉じ、triggerがfocusを持つことを確認。EscapeでもRadix既定挙動を補助確認 |
| AC-7 | 既存の前月/翌月、年またぎ、上下限、category保持testsを維持 |
| AC-8 | test内でlanguageをJapaneseへ切り替え、trigger `2025年5月` とtitle `年月を選択` を確認しEnglishへ復帰 |
| AC-9 | `MonthPicker.test.tsx` の既存default表示・選択testsとunit suiteで回帰確認 |
| AC-10 | diff reviewとWeb verification batchで対象外差分がないことを確認 |

Storybook browser-testは追加しない。変更対象Storyに`browser-test` tagがなく、`.storybook-test`やbrowser-test設定も変更しないため、`pnpm run web:test:storybook` は不要である。

## Build / Verifyへの入力

1. `resources.ts` に `date.selectYearMonth` の英日文言を追加する。
2. `MonthPicker` にoptional `size` propを追加し、両Selectへ渡す。default挙動を維持する。
3. `MonthSelector` の常時 `MonthPicker` をlocale-aware trigger + Dialog + large `MonthPicker`へ置き換える。navigate/前後月ロジックは維持する。
4. `MonthSelector.test.tsx` をdialog操作へ更新し、1表示、open、選択反映、category保持、focus復帰、日本語、既存前後月を確認する。
5. `MonthPicker.stories.tsx` に `Large` storyを追加する。
6. `pnpm run web:format` 後、Web verification batchを同時実行する。Storybook browser-testは対象条件に該当しない限り実行しない。
7. Storyまたは実画面で、通常表示の情報密度、dialog内select size、狭幅、focusをvisual checkする。

## リスクと確認事項

- search更新で `MonthSelector` が同じroute内に維持されずdialogがunmountする場合、focus復帰が成立しない。現行navigateは同じ `/payments` へのsearch更新なので成立する想定だが、Build / Verifyのtestで確認する。
- Radix Dialog内のSelect.Contentはportalを使う。testではdialogの `within` にoptionを限定せず、roleで選択肢を取得する。
- Japaneseのclose aria-labelは共通templateから `年月を選択を閉じる` になる。文型の改善は共通i18n変更となるため対象外とし、アクセシブルな識別可能性だけを維持する。
- `size="3"` でも要求する操作性差が視覚的に不足する場合、独自CSSで補わずStopし、Requirements/Design判断として扱う。
- Dialogを開いたまま年月を変えたときにopen状態が失われる場合、別stateや自動closeで補わずStopする。

## Verification

このDesign Doc作成はdocumentation-onlyであり、アプリケーション検証コマンドは実行しない。Requirements、選択したrule-mapサブグラフ、現行コード/testsとの整合を確認する。

## Rule / Policy Check

- RequirementsのFR-1〜FR-6とAC-1〜AC-10へ実装・test判断を追跡できる。
- Requirementsを変更せず、保存/確定、自動close、別state、年月範囲拡張を追加していない。
- `web.design-rules` に沿い、current stateをbuttonにし、Dialogにtitle/closeを置き、focusをtriggerへ戻す。
- `web.component-structure` に沿い、既存 `MonthSelector` が1つのDialog操作境界を所有し、薄いcomponentを追加しない。
- `web.test-policy` に沿い、ユーザーに残る表示・URL・focus・i18nをtestし、visual sizeをStory/visual checkへ分離する。
- DB/API/Auth/RLS/RPC、domain、query/cache、集計ロジック、新規依存を変更しない。

## Stop条件

- Requirementsの修正が必要になる。
- 年月選択に保存/確定、rollback、自動closeなどRequirementsにない操作判断が必要になる。
- dialog内だけのsize差を既存Radix propsで実現できない。
- search更新後のdialog継続またはfocus復帰を別のプロダクト挙動なしに実現できない。
- 支払い画面以外の `MonthPicker` 体験変更が必要になる。
- 新規依存、DB/API/Auth/RLS/RPC、domain/query/cache/集計ロジック変更が必要になる。
- Designまたは実装方針が選択したrule/policyに違反する、または違反の可能性がある。
