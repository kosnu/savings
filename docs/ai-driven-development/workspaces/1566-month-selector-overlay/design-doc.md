---
title: "Design Doc: 支払い画面の年月選択を短い値選択用ポップオーバーにする"
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
  - popover
  - accessibility
  - validation
when_to_read:
  - Issue #1566 の年月選択改善を実装するとき
  - MonthSelector の一時面、URL年月、focus境界を確認するとき
---

# Design Doc: 支払い画面の年月選択を短い値選択用ポップオーバーにする

## 入力

- Cycle ID: `issue-1566-month-selector-overlay-20260801-03`
- Requirements / PRD: `docs/ai-driven-development/workspaces/1566-month-selector-overlay/requirements.md`
- Issue: #1566
- Previous Cycle: `issue-1566-month-selector-overlay-20260801-02`
- Branch / PR: `issue-1566/month-selector-overlay` / #1622
- 対象画面: `/payments`

`requirements.md`はread-only入力として扱い、このGoalでは変更しない。

## 要約

年月選択は年と月だけを扱う短い値選択であるため、Web Design Rulesの既定表現であるtrigger接続型のanchored popoverを採用する。`MonthSelector`が現在利用する共有`ResponsiveOverlay`をRadix Themesの`Popover`へ置き換え、年月triggerとの位置関係を保つ一時面にする。

popoverはcontrolled open stateを持ち、見えるtitle、明示的なclose操作、通常時より大きい`MonthPicker`を含む。年または月の選択がURLへ反映された時点で閉じ、Radixのfocus管理により元の年月triggerへfocusを戻す。外側clickとEscapeによるdismissも維持する。

通常時の前月button、年月trigger、翌月buttonは`gap="3"`のボタン群を維持する。URL年月は既存`useDateRange`のvalidation済みdateと`isAllowedMonth`を使い、不正・範囲外・片側欠落をformatしない。Summaryの非同期安定状態testを含む前cycleで成立済みの境界は変更しない。

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- Classification:
  - path: `MonthSelector`, `MonthSelector.test`, `design-doc.md`
  - domain: `date`, `payment`, `category`, `web-ui`, `test`
  - activity: `write_design_doc`, `change_payment_ui`, `change_dialog`, `review_test_gap`
  - topic: `month`, `popover`, `focus`, `URL validation`, `regression`
- Selected:
  - `ai-driven.workflow`: Design責務とRequirements read-only境界。
  - `documentation.policy`: canonical Design Doc形式。
  - `web.design-system-brand`: 通常面と一時面の視覚方針。
  - `web.design-rules`: 短い値選択のanchored popover、title、close、focus、`gap="3"`、responsive。
  - `web.component-structure`: 既存feature component内の変更境界。
  - `web.domain-ui-rules`: 対象月の識別・検索条件、不正・未解決状態。
  - `web.domain-layer-rules`: 既存の横断的な年月validationを再利用。
  - `web.test-policy`: 境界監査、回帰、非同期安定状態。
  - `web.storybook-browser-tests`: 一時面とfocusのブラウザ検証境界。
  - `domain.date`, `domain.payment`, `domain.category`: 対象月と既存支払い・category境界。
- Depends-on: `ai-driven.overview`, `domain.amount`。
- Conflict decision: Requirementsに既定と異なるダイアログのプロダクト意図・成功条件がないため、`web.design-rules`の短い値選択既定を適用する。centered dialogと`ResponsiveOverlay`は採用しない。

## Domain Value UI Decisions

| 値 | 利用目的 | 主表示・操作 | 不正・未解決状態 |
| --- | --- | --- | --- |
| 現在の対象年月 | 支払いとサマリーの対象を識別する | locale-awareな1つのghost button label | validation済みかつ選択範囲内でない場合は「年月を選択」fallback。無効な年月はformatしない。 |
| 年・月の選択値 | 対象月を選ぶ | triggerに接続したpopover内のlarge `MonthPicker` | 有効な現在値だけを渡し、fallback状態では未選択として表示する。 |
| `year` / `month` | 対象月のsource of truth | 選択時に既存navigateで更新 | `useDateRange`の既存validationを表示側も共有する。新しい正規化・復帰操作は追加しない。 |
| `category` | 支払いの絞り込み | 年月UIには表示しない | search updaterで保持する。 |
| 前月・翌月 | 隣接月へ移動 | 現行icon-only ghost buttons | 有効な対象月のときだけ既存上下限を判定する。 |

## 変更対象

### `apps/web/src/features/summaryByMonth/MonthSelector/MonthSelector.tsx`

- `ResponsiveOverlay` importを除き、Radix Themesの`Popover`とtitle表示用`Text`、close用`Cross1Icon`を利用する。
- `const [open, setOpen] = useState(false)`を維持し、`Popover.Root`へ`open`と`onOpenChange={setOpen}`を渡す。
- `Popover.Trigger`へ現在年月の`Button type="button" size="3" variant="ghost"`を渡す。
- `Popover.Content`に`date.selectYearMonth`のaccessible nameを付け、見えるtitleも同じ文言にする。
- title行の右端に`Popover.Close`と`IconButton`を置き、既存`common.close`のaria-labelと`Cross1Icon`を使う。
- 本文は`gap="4"`、`MonthPicker size="3"`とし、新しいCSSを追加しない。
- `handleOverlayMonthChange`は有効値だけ既存`handleMonthChange`へ渡し、同じ操作で`setOpen(false)`にする。
- `useDateRange`、`isAllowedMonth`、locale label、category保持、前月・翌月、上下限は変更しない。
- 新しいcomponent、formatter、URL state、保存/確定button、依存を追加しない。

### `apps/web/src/features/summaryByMonth/MonthSelector/MonthSelector.test.tsx`

- 「ダイアログ」固定のtest名を「一時面」または「ポップオーバー」へ変更する。
- trigger操作でaccessible nameを持つpopover contentが開き、Year / Month comboboxとclose buttonを操作できることを確認する。
- `data-overlay-variant="dialog"`のassertionを除き、共有ResponsiveOverlayの表現へ固定しない。
- close buttonで閉じた後に年月triggerへfocusが戻ることを維持する。
- 年または月の選択でURL、label、popover不在、trigger focusの最終安定状態を`waitFor`する。
- 日本語title、category保持、前後月、上下限、年またぎ、不正・範囲外・片側欠落URLの既存回帰を維持する。
- MonthPickerのSelect.Contentがportalされても選択操作が成立し、親popoverが選択完了まで不意に閉じないことを既存の月選択testで確認する。

### 変更しない対象

- `requirements.md`: 現cycleのread-only入力。
- `ResponsiveOverlay`: 他用途のPC dialog/mobile sheet契約は変更しない。
- `MonthPicker`: optional size、選択範囲、他利用箇所の契約を維持する。
- `useDateRange`: 欠落・非整数・month範囲外をnullにする既存契約を維持する。
- `Summary.test.tsx`: 非同期progressbarの安定状態待ちは既に正本test policyと整合しており変更しない。
- `resources.ts`: `date.selectYearMonth`と`common.close`を再利用する。
- API、query key、MSW handler、DB、Auth、RLS、RPC、支払い・category・予算domain。

## 状態遷移

1. 有効なURL年月: locale labelを表示し、triggerからanchored popoverを開く。
2. popover open: title、close、現在値を持つlarge Year / Month controlsを表示する。
3. 年または月の選択: 有効dateを既存navigateへ渡し、同じ操作でopenをfalseにする。
4. close完了: triggerへfocusが戻り、URL更新後のlabelを表示する。
5. close button、外側click、Escape: URLを変更せずopenをfalseにし、triggerへfocusを戻す。
6. URL欠落・不正・範囲外: fallback labelを表示し、Intl format、API契約変更、新しい復帰UIは実行しない。
7. 初期化hookが欠落値を補完した場合: `useDateRange`のdateが有効になり、通常labelと既存画面状態へ移る。

## 主要文言

| 用途 | English | Japanese |
| --- | --- | --- |
| popover title / fallback trigger | Select year and month | 年月を選択 |
| close aria-label | Close Select year and month | 年月を選択を閉じる |
| year / month | Year / Month | 年 / 月 |
| previous / next | Previous month / Next month | 前月 / 翌月 |

新しい文言は追加しない。

## 採用しない案

### 共有`ResponsiveOverlay`を維持する

短い値選択にPC dialog/mobile full-screen sheetを使う例外根拠がRequirementsにないため採用しない。共有component自体の他用途は変更しない。

### `Dialog`をMonthSelectorへ直接置く

centered dialogは短い作成・更新・確認用であり、短い値選択の既定から外れる。Requirementsに意図・成功条件がないため採用しない。

### 新しい共通MonthPopover componentを作る

利用箇所はMonthSelectorだけであり、新しい抽象化やcomponent境界は不要なため採用しない。

### URL parserやformatterを追加する

既存`useDateRange`とlocale formatterで契約が成立しており、責務を重複させるため採用しない。

## 既存挙動への影響

- `/payments`の任意年月選択だけをResponsiveOverlayからanchored popoverへ変更する。
- PC・モバイルともtriggerに接続した短い値選択として表示し、長い入力用full-screen sheetへ切り替えない。
- 選択後close、dismiss後focus、category、URL正本、前月・翌月、上下限、年またぎ、不正URL fallbackを維持する。
- API request、URL正規化、`MonthPicker`の他利用箇所、共有overlayの契約は変更しない。

## 受け入れ条件とテスト方針

| AC | 永続テスト / 確認 |
| --- | --- |
| AC-1 | MonthSelector test: locale-awareな1つのtrigger |
| AC-2 | implementation review: outer Flex `gap="3"`; desktop/mobile visual check |
| AC-3 | MonthSelector test: triggerからnamed popover contentを開く; implementation reviewでRadix Popover使用 |
| AC-4 | 既存MonthPicker tests/large storyとpopover内integration |
| AC-5 | MonthSelector test: select→URL/label→close→trigger focus |
| AC-6 | MonthSelector test: close button→close→trigger focus; Escape/outsideはRadix Popover契約とbrowser check |
| AC-7 | 既存category、前後月、年またぎ、上下限tests |
| AC-8 | table-driven invalid/partial/out-of-range URL testsと既存useDateRange tests |
| AC-9 | diff review: API/query/MSW/他MonthPicker/ResponsiveOverlay契約に差分なし |
| AC-10 | Summary testがwaitForでprogressbar 3件の安定状態を検証することを確認 |
| AC-11 | Web必須検証batchとdesktop/mobile browser check |

`browser-test` tag、Page story、Storybook設定は変更しないため、AGENTS.mdの条件上`web:test:storybook`は必須batchに追加しない。既存Payment Page storyまたは実画面でdesktop/mobile viewportのanchored位置、MonthPicker portal、close/focusを確認する。

## Build / Verifyへの入力

1. `MonthSelector`をcontrolled Radix Themes `Popover`へ変更し、title、close、large MonthPickerを配置する。
2. URL validation、選択handler、`gap="3"`、前後操作を維持する。
3. `MonthSelector.test.tsx`をpopover表現へ更新し、選択portal、close/focus、不正URL回帰を確認する。
4. `Summary.test.tsx`の安定状態testを変更せず確認する。
5. `pnpm run web:format`後、`web:lint`、`web:format-check`、`web:typecheck`、`web:test:unit-integration`を同じbatchで実行する。
6. desktop/mobileでanchored popover、年月操作群、選択後close/focus、不正URLをvisual/interaction確認する。
7. 差分がRequirements、最新policy、対象外境界と一致することを確認する。

## リスクと確認事項

- `MonthPicker`のSelect.Contentはportalされる。親Popoverが選択途中に閉じないことをintegration testとbrowserで確認する。
- navigateとcloseは同じuser actionで開始する。testではURL、label、popover不在、focusの最終安定状態をまとめて待つ。
- `useDateRange`は選択可能year範囲を検証しないため、`isAllowedMonth`との二段階checkを省略しない。
- 欠落URLは初期化hookが非同期に補完する。MonthSelector単体testではfallback、Pageでは補完後の通常状態を既存testと合わせて扱う。
- モバイルでpopover contentやYear / Month controlsがviewportからはみ出さないことを確認する。

## Verification

このDesign Doc作成はdocumentation-onlyである。最新Requirements、既存`MonthSelector` / `MonthPicker` / `DatePicker` / `useDateRange` / tests、選択したrule-mapサブグラフと照合する。

## Rule / Policy Check

- RequirementsのFR-1〜FR-6とAC-1〜AC-11へ実装・test判断を追跡できる。
- Requirementsを変更せず、保存/確定、URL自動補正、新規component/依存を追加していない。
- Web Design Rulesの短い値選択既定に従い、anchored popoverを採用し、既定外dialogを補っていない。
- Web Test Policyに従い、不正・未解決URL、nested Select、非同期安定状態を回帰対象にした。
- 支払い画面外の共有component、validation、API/domain契約へ変更を波及させない。

## Stop条件

- Requirementsの修正または新しいユーザー操作が必要になる。
- anchored popoverでは成立せず、既定と異なるdialogの意図・成功条件が必要になる。
- `ResponsiveOverlay`、`MonthPicker`、`useDateRange`、支払い画面外の契約変更が必要になる。
- URL自動正規化や復帰UIの仕様追加が必要になる。
- 新規依存、DB/API/Auth/RLS/RPC、domain/query/cache変更が必要になる。
- Designまたは実装方針が選択したrule/policyに違反する、または違反の可能性がある。
