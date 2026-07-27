---
title: "Design: よくある支払い候補を一列の横スクロール領域にする"
doc_type: design
status: accepted
area: web
applies_to:
  - apps/web/src/features/payments/createPayment
  - apps/web/src/app/routes/PaymentsPage
topics:
  - ai-driven-development
  - design-doc
  - payments
  - frequent-payments
  - card
  - horizontal-scroll
  - responsive
  - browser-test
when_to_read:
  - Issue #1608の候補Card列を実装、検証するとき
  - よくある支払い候補のnowrap、overflow、縮小境界を確認するとき
---

# Design: よくある支払い候補を一列の横スクロール領域にする

## 1. 文書の位置づけ

- Requirements: `docs/ai-driven-development/workspaces/1608-frequent-payments-scroll/requirements.md`
- Cycle ID: `444977F1-BCFE-4306-A319-A6CF46F7595E`
- Artifact lineage: `docs/ai-driven-development/workspaces/1608-frequent-payments-scroll/`
- Branch: `issue-1608/frequent-payments-scroll`

この文書は同じcycleの最新Requirementsを実装方針へ展開する。Requirementsはread-onlyとし、この文書の都合で要求、対象外、受け入れ条件を追加または変更しない。

## 2. Inputs

### 対象コード

- `apps/web/src/features/payments/createPayment/FrequentPaymentSuggestions/FrequentPaymentSuggestions.tsx`
- `apps/web/src/features/payments/createPayment/FrequentPaymentSuggestions/FrequentPaymentSuggestions.module.css`
- `apps/web/src/app/routes/PaymentsPage/PaymentPage.stories.tsx`

### 変更不要として確認するコード

- `FrequentPaymentSuggestions/FrequentPaymentSuggestions.test.tsx`
  - semantic group、Card内の値、click、keyboard、disabled、非blocking状態を既に検証している。
- `FrequentPaymentSuggestions/FrequentPaymentSuggestions.stories.tsx`
  - leaf componentの通常・長文・状態カタログを維持する。実layoutのbrowser testはPage Storyで扱う。
- `CreatePaymentForm/CreatePaymentForm.test.tsx`
- `CreatePaymentModal/CreatePaymentModal.test.tsx`
  - 候補選択後の3field置換、非submit、日付維持、送信中disabled、連続作成を既に検証している。
- fetch、query key、cache invalidation、i18n、domain utility、MSW handler本体。

### 維持する既存境界

- `Heading`と`fieldset`のprogrammatic relation。
- Radix `Card asChild`とnative `button`によるpointer、Enter、Space、focus、disabled semantics。
- Card内のメモ、金額、カテゴリの2段構造と長文wrap。
- 候補の抽出、頻度順、最大5件、Book、期間、再取得。
- 候補選択後のフォーム値置換と非submit。
- loading、error、empty時の非表示。

## 3. Rule Selection

### 作業分類

- path: `apps/web/src/features/payments/createPayment/**`, `apps/web/src/app/routes/PaymentsPage/PaymentPage.stories.tsx`
- domain: `payment`, `amount`, `category`, `web-ui`, `test`
- activity: `change_payment_ui`, `change_responsive_layout`, `change_storybook_browser_test`
- topic: `frequent-payments`, `card`, `horizontal-scroll`, `responsive`, `accessibility`, `browser-test`

### Selected nodes

- `ai-driven.workflow`
  - Designの責務、Requirementsのread-only境界、Stop条件。
- `documentation.policy`
  - Design Docのfront matterと責務。
- `web.design-system-brand`
  - 日常の支払い登録を簡潔な道具として維持する。
- `web.design-rules`
  - Radix props優先、横並び、縮小禁止、responsive、overflowの判断。
- `web.domain-ui-rules`
  - メモ、金額、カテゴリを候補識別のための既存値として維持する。
- `web.test-policy`
  - ユーザーに残るlayout挙動を回帰テスト対象にする。
- `web.storybook-browser-tests`
  - DOM geometryを実ブラウザで確認するPage Storyの責務。

### Depends-on nodes

- `ai-driven.overview`: GoalとDesign Docの位置づけ。
- `domain.payment`: メモ、金額、任意カテゴリの既存意味。
- `domain.amount`: 金額表記を変更しない前提。
- `domain.date`: 候補期間とフォーム日付を変更しない前提。
- `domain.category`: カテゴリなしを含む既存表示を変更しない前提。

### Conflict decision

- Requirementsが候補領域に限定したmobile横スクロールを明示しているため、`web.design-rules`の一般的なmobile横スクロール禁止に対する機能固有の差分として実装する。
- 例外を候補groupの`overflow-x`だけへ閉じ、ページ、フォーム、Card内テキストへ広げない。
- componentの追加、移動、抽出を行わないため、`web.component-structure`の変更triggerには該当しない。既存component境界を維持する。

## 4. Domain Value UI Decisions

| 値 | 利用目的 | 表示判断 |
| --- | --- | --- |
| メモ | 候補の主対象を識別する | 既存Card上段の主情報を変更しない。Card内の長文wrapを維持する。 |
| 金額 | 候補を識別し入力値を再利用する | 既存Card下段の補助情報と通貨表記を変更しない。 |
| カテゴリ | 候補を識別し分類を再利用する | 既存Card下段の補助情報とカテゴリなし表現を変更しない。 |
| 候補順序 | 目的の候補を探す | DOM順、横方向の視覚順、focus順を既存の頻度順で一致させる。 |

値なし、loading、error、候補0件、disabledは既存状態を維持する。今回追加する状態表示や文言はない。

## 5. 採用する実装方針

### 5.1 semantic groupをscroll containerとして維持する

既存の`Flex asChild`と`fieldset aria-labelledby={headingId}`を維持する。`Flex`の`wrap`を`wrap`から`nowrap`へ変更し、Card列が一列であることをRadix propで明示する。

- DOM順序とsemantic groupを変えない。
- 新しいwrapperを追加しない。
- `gap="2"`、Headingとの関係、fieldset resetを維持する。
- `fieldset`自身が候補の横並びと横overflowを所有するため、scroll containerとaccessible groupが同じ候補集合を表す。

### 5.2 overflowを候補groupへ閉じ込める

`.group`へ次の責務を持たせる。

- `min-width: 0`: column Flexの子として内容幅まで押し広げられないようにする既存境界。
- `max-width: 100%`: 候補groupを支払いフォームの利用可能幅以内に収める。
- `overflow-x: auto`: 候補Cardの合計幅がgroup幅を超えた場合だけ横スクロールを提供する。
- fieldsetのmargin、padding、border resetは維持する。

ページ、dialog、フォームへ`overflow-x`を追加しない。横スクロールの所有者を候補groupだけにする。

### 5.3 各候補Cardを縮小させない

`Card asChild`によりflex itemでもある`.candidate`へ`flex-shrink: 0`を追加する。

- 複数Cardを親幅に押し込む縮小を防ぎ、合計幅が超えたときにgroupのscroll overflowを発生させる。
- 既存`max-width: 100%`を維持し、単一CardとCard内の長い値は親幅を超えない。
- 既存`white-space: normal`と`.value`の`overflow-wrap: anywhere`を維持し、Card内の長文wrapは変えない。
- Cardの固定幅、固定height、独自paddingは追加しない。

### 5.4 user操作とaccessibilityを変更しない

- button role、accessible name、click、Enter、Space、focus、disabledを変更しない。
- DOMを並べ替えず、視覚順とfocus順を一致させる。
- scrollbarの代替ボタン、説明文、gradient、snap、初期scroll位置制御を追加しない。
- keyboard focusでブラウザがfocused buttonをscroll container内へ表示するnative挙動を妨げない。

## 6. Browser-test Story

`PaymentPage.stories.tsx`は既にPage Storyかつ`browser-test`対象であり、Router、QueryClient、MSW、dialog portalを含む実画面境界を持つ。ここへ`FrequentPaymentsOverflow` Storyを追加する。

### Story data

- mocked date: 既存の2025-06-15。
- default Book: `createBookHandlers()`を追加する。
- 同一Book、対象期間内、category ID 10の支払いを、異なるメモと金額の5候補について各3件用意する。
- 5件すべてが候補になる既存抽出条件を利用し、product codeへtest専用入口を追加しない。

### Play assertions

1. Payments PageのCreate payment buttonを押し、portal内のdialogを開く。
2. `Frequent payments`というaccessible nameのgroupと5つの候補buttonを取得する。
3. computed styleが`flex-wrap: nowrap`と`overflow-x: auto`であることを確認する。
4. `group.scrollWidth > group.clientWidth`で実overflowが発生していることを確認する。
5. groupを末尾へscrollし、最後の候補がgroupの表示範囲内へ入ることを確認する。
6. document elementの`scrollWidth <= clientWidth`を確認し、ページ全体へ横overflowしていないことを確認する。

leaf componentの同名testはpointer、keyboard、disabled、ARIA回帰を引き続き所有する。Page Storyは実layout geometryだけを追加で所有し、選択結果の重複testを追加しない。

## 7. 変更対象

| ファイル | 変更 |
| --- | --- |
| `FrequentPaymentSuggestions.tsx` | 候補groupのFlexを明示的`nowrap`へ変更する。 |
| `FrequentPaymentSuggestions.module.css` | groupの最大幅と横overflow、candidateの縮小禁止を追加する。 |
| `PaymentPage.stories.tsx` | 実overflow、末尾到達、ページoverflow不在を確認するbrowser-test Storyを追加する。 |

Requirements、Design Doc以外のドキュメント、leaf Story、component test、form/modal test、i18n、fetch/query/domain/handler本体は変更しない。

## 8. 採用しない案

- `flex-wrap: nowrap`だけを指定する。
  - 子Cardがflex-shrinkで縮み、overflowが発生せずCardの読みやすさを損なう可能性があるため。
- Cardへ固定幅または`min-width`を追加する。
  - 既存の内容幅と`max-width: 100%`で要求を満たせ、任意の固定寸法はRequirementsにないため。
- scroll用wrapperを新設する。
  - semantic groupとscroll対象を分離し、既存DOMへ不要な階層を増やすため。
- dialogまたはページ全体を横スクロールさせる。
  - Requirementsのoverflow所有境界に反するため。
- Card内の長い値をnowrapまたはellipsisにする。
  - Card列とCard内テキストの折り返し境界を混同し、対象外の表示変更になるため。
- leaf Storyへ`browser-test` tagを付ける。
  - browser-test projectはPage Storyだけを読み込み、policyもproviderと実画面境界を持つPage Storyを優先するため。
- jsdom component testで`scrollWidth`を検証する。
  - layout geometryを実ブラウザ同等に計算できず、ユーザーに残るoverflow挙動を保証できないため。

## 9. 受け入れ条件とテスト対応

| AC | 対応 |
| --- | --- |
| AC-1〜AC-5 | Page browser-testでnowrap、実overflow、末尾到達を確認。狭幅は同Storyを375pxでも手動確認。 |
| AC-6〜AC-7 | 既存leaf testのclick、Enter、button role、accessible nameを維持。Page Storyで5候補buttonの存在を確認。 |
| AC-8 | Page browser-testでdocument elementに横overflowがないことを確認。 |
| AC-9 | TSX構造と既存leaf test/Storyを変更せず、Card内3値と長文wrapを維持。 |
| AC-10 | 既存component/form/modal/integration testを標準Web検証で通す。 |
| AC-11 | diff reviewでDB/API/Auth/RLS/依存変更がないことを確認。 |

## 10. 既存挙動への影響

- 候補Card列だけがwrapからnowrap + overflowへ変わる。
- Cardの内容幅、最大幅、内部wrap、文字階層、surface、paddingは変わらない。
- 候補の抽出、順序、件数、Book/date境界、query、invalidationは変わらない。
- 候補選択後に置換するfield、非submit、日付維持は変わらない。
- loading、error、empty、disabled、連続作成は変わらない。
- 新しいユーザー向け文言や操作はない。

## 11. リスクと確認事項

- Radix Flexの`nowrap`とcandidateの`flex-shrink: 0`が実browserで期待どおりscroll overflowを生成することをbrowser-testで確認する。
- fieldsetがcolumn Flexの子として親幅を超えないことを、Page Storyと375px手動確認で確認する。
- 最後の候補へ横scrollでき、focusとpointer操作がscroll位置に依存しないことを確認する。
- browserによるscrollbar表示差は許容し、scrollbarの装飾や常時表示を要求しない。

## 12. Verification

Design工程ではアプリ検証を実行しない。Requirements、選択ルール、現行実装、ACとテスト方針の対応、変更対象のscope、`git diff --check`を確認する。
