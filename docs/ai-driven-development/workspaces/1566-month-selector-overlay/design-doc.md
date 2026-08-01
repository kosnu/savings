---
title: "Design Doc: 支払い画面の年月選択をプロダクト標準オーバーレイにする"
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
  - responsive-overlay
  - accessibility
  - validation
when_to_read:
  - Issue #1566 の年月選択改善を実装するとき
  - MonthSelector のoverlay、URL年月、focus境界を確認するとき
---

# Design Doc: 支払い画面の年月選択をプロダクト標準オーバーレイにする

## 入力

- Cycle ID: `issue-1566-month-selector-overlay-20260801-02`
- Requirements / PRD: `docs/ai-driven-development/workspaces/1566-month-selector-overlay/requirements.md`
- Issue: #1566
- Previous Cycle: `issue-1566-month-selector-overlay-20260730-01`
- Branch / PR: `issue-1566/month-selector-overlay` / #1622
- 対象画面: `/payments`

`requirements.md`はread-only入力として扱い、このGoalでは変更しない。

## 要約

`MonthSelector`に直接置かれたcentered `Dialog`を、既存の共有`ResponsiveOverlay`へ置き換える。PCでは標準dialog、モバイルでは全画面sheetとなり、同じopen stateと子component stateを維持するプロダクト標準のoverlayを利用する。`MonthSelector`はcontrolled open stateを所有し、年月選択がURLへ反映される操作でoverlayを閉じる。`ResponsiveOverlay`のtriggerを通したRadix focus管理により、選択完了またはdismiss後に年月triggerへfocusを戻す。

通常時の前月button、年月trigger、翌月buttonは1つのボタン群として`gap="3"`で配置する。

URL年月の解釈は`MonthSelector`独自の`parseInt`と`Date`生成をやめ、既存`useDateRange`が返すvalidation済みdateを再利用する。さらに`MonthSelector`固有の選択可能範囲を`isAllowedMonth`で確認し、両方を満たす値だけを表示・選択値・前後月計算に使う。欠落、非整数、month範囲外、選択範囲外はfallback labelとして安全に扱い、`Intl.DateTimeFormat`へ不正なdateを渡さない。

PR #1622のunit-test失敗は、非同期に1件ずつ現れるprogressbarへ`findAllByRole`が最初の1件でresolveした直後に3件を期待したことが原因である。`waitFor`内で安定した3件を検証する形へ変更する。

## Rule Selection

- Rule map: `docs/harness/rule-map.json`
- Classification:
  - path: `MonthSelector`, `Summary.test`, `useDateRange`, `ResponsiveOverlay`, `design-doc.md`
  - domain: `date`, `payment`, `category`, `web-ui`, `test`
  - activity: `write_design_doc`, `change_payment_ui`, `change_dialog`, `review_test_gap`
  - topic: `month`, `overlay`, `responsive`, `focus`, `URL validation`, `async regression`
- Selected:
  - `ai-driven.workflow`: Design責務とRequirements read-only境界。
  - `documentation.policy`: canonical Design Doc形式。
  - `web.design-system-brand`: 通常面と一時面の視覚方針。
  - `web.design-rules`: ボタン群`gap="3"`、overlay、PC/mobile、close、focus。
  - `web.component-structure`: overlay/focus操作境界と既存共有componentの再利用。
  - `web.domain-ui-rules`: 対象月の識別・検索条件、不正・未解決状態。
  - `web.domain-layer-rules`: 既存の横断的な年月validationを再利用。
  - `web.test-policy`: 境界監査、回帰、非同期安定状態。
  - `web.storybook-browser-tests`: overlay/focusのブラウザ検証境界。
  - `domain.date`, `domain.payment`, `domain.category`: 対象月と既存支払い・category境界。
- Depends-on: `ai-driven.overview`, `domain.amount`。
- Conflict decision: Requirementsの明示的なプロダクト標準overlay要求に従い、短い値選択の一般既定より既存`ResponsiveOverlay`を優先する。

## Domain Value UI Decisions

| 値 | 利用目的 | 主表示・操作 | 不正・未解決状態 |
| --- | --- | --- | --- |
| 現在の対象年月 | 支払いとサマリーの対象を識別する | locale-awareな1つのghost button label | validation済みかつ選択範囲内でない場合は「年月を選択」fallback。無効な年月はformatしない。 |
| 年・月の選択値 | 対象月を選ぶ | overlay内のlarge `MonthPicker` | 有効な現在値だけを渡し、fallback状態では未選択として表示する。 |
| `year` / `month` | 対象月のsource of truth | 選択時に既存navigateで更新 | `useDateRange`の既存validationを表示側も共有する。新しい正規化・復帰操作は追加しない。 |
| `category` | 支払いの絞り込み | 年月UIには表示しない | search updaterで保持する。 |
| 前月・翌月 | 隣接月へ移動 | 現行icon-only ghost buttons | 有効な対象月のときだけ既存上下限を判定する。 |

## 変更対象

### `MonthSelector.tsx`

- `Dialog`、`Cross1Icon`、`useLocation`、`useMemo`を年月overlay・parse用途から除く。
- `ResponsiveOverlay`、`useDateRange`、`useState`を利用する。
- `const [open, setOpen] = useState(false)`を持ち、`ResponsiveOverlay`へ`open`と`onOpenChange={setOpen}`を渡す。
- `ResponsiveOverlay`の`trigger`へ現在年月の`Button type="button" size="3" variant="ghost"`を渡す。
- titleは既存`date.selectYearMonth`、childrenは`MonthPicker size="3"`とする。共有overlayがclose button、PC dialog/mobile sheet、title、focus管理を所有するため、MonthSelectorで重複実装しない。
- 外側`Flex`を`gap="3"`へ変更する。
- `useDateRange().date`を受け取り、`date && isAllowedMonth(date) ? date : null`を`currentDate`とする。
- `currentDate`がある場合だけlocale-aware年月label、index、`MonthPicker.value`へ使用する。ない場合は既存fallback labelを使う。
- 既存`handleMonthChange`はURL更新と範囲checkの責務を維持する。
- overlay用`handleOverlayMonthChange`を分け、有効値なら`handleMonthChange(date)`を呼んで`setOpen(false)`にする。前月・翌月handlerはoverlay stateを変更しない。
- 新しいcomponent、CSS、formatter、URL state、保存/確定buttonを追加しない。

### `MonthSelector.test.tsx`

- open testは`data-overlay-variant="dialog"`を確認し、直接`Dialog`ではなく標準`ResponsiveOverlay`統合を固定する。
- 年または月を選択したtestで、URLとlabel更新に加えてoverlayが閉じ、年月triggerへfocusが戻るまで`waitFor`する。
- category保持も選択後closeと両立することを確認する。
- dismiss buttonでclose/focusが成立する既存testを維持する。
- 正常、2022-01下限、2032-12上限、年またぎの既存testsを維持する。
- table-driven testで少なくとも次を確認する。
  - `year=abc&month=5`
  - `year=2025&month=abc`
  - `year=2025&month=0`
  - `year=2025&month=13`
  - 選択範囲外のyear
  - yearのみ、monthのみ
- 各無効・未解決URLでrenderがthrowせず、fallback triggerが表示され、不正な年月labelを表示しない。
- mobile sheetへの切替契約は共有`ResponsiveOverlay.test.tsx`の既存testを根拠にし、MonthSelector側でmatchMedia controllerを重複実装しない。ブラウザvisual checkではPayment pageをmobile viewportでも確認する。

### `Summary.test.tsx`

- `expect(await screen.findAllByRole("progressbar")).toHaveLength(3)`を、`waitFor`内の`screen.getAllByRole("progressbar")`で3件の安定状態を待つ検証へ変更する。
- 表示内容、handler、fixtureは変更しない。

### 変更しない対象

- `ResponsiveOverlay`: 既にPC dialog/mobile sheet、trigger、dismiss、focusを所有するため変更しない。
- `useDateRange`: 欠落・非整数・month範囲外をnullにする既存契約をそのまま再利用する。
- `MonthPicker`: 前cycleで追加済みのoptional sizeと既存選択範囲を維持する。
- `resources.ts`: 既存`date.selectYearMonth`と`common.close`を再利用する。
- API、query key、MSW handler、DB、Auth、RLS、RPC、支払い・category・予算domain。

## 状態遷移

1. 有効なURL年月: locale labelを表示し、triggerからoverlayを開く。
2. 年または月の選択: 有効dateを既存navigateへ渡す。同じ操作でopenをfalseにする。
3. close完了: Radix triggerへfocusが戻る。URL更新後のlabelを表示する。
4. dismiss: URLを変更せずopenをfalseにし、triggerへfocusを戻す。
5. URL欠落・不正・範囲外: dateを確定値として扱わずfallback labelを表示する。Intl format、API契約変更、新しい復帰UIは実行しない。
6. 初期化hookが欠落値を補完した場合: `useDateRange`のdateが有効になり、通常labelと既存画面状態へ移る。

## 主要文言

| 用途 | English | Japanese |
| --- | --- | --- |
| overlay title / fallback trigger | Select year and month | 年月を選択 |
| close aria-label | Close Select year and month | 年月を選択を閉じる |
| year / month | Year / Month | 年 / 月 |
| previous / next | Previous month / Next month | 前月 / 翌月 |

新しい文言は追加しない。

## 採用しない案

### `Dialog`をMonthSelector内でresponsive化する

共有`ResponsiveOverlay`のPC/mobile、close、focus、safe areaを重複実装するため採用しない。

### anchored popoverを新規実装する

Requirementsは既存プロダクト標準のPC/mobile overlayを明示しており、共有`ResponsiveOverlay`がその契約を所有するため採用しない。

### MonthSelectorでURL文字列を再parseする

`useDateRange`とvalidation責務が重複し、不正値の扱いが再び分岐するため採用しない。

### search schemaまたは初期化hookで不正値を自動補正する

新しいURL正規化・復帰仕様になりRequirementsを超えるため採用しない。今回の範囲は既存validationの再利用と安全表示である。

### 共通年月formatterを追加する

現在必要なのはMonthSelector固有のlocale labelだけであり、同じyear+month表示契約の複数利用箇所がないため抽象化しない。

## 既存挙動への影響

- `/payments`の任意年月選択だけを、centered DialogからResponsiveOverlayへ変更する。
- PCでは既存と同じdialog roleを維持し、モバイルでは共有componentのsheet表現になる。
- 選択後はoverlayを閉じる。category、URL正本、前月・翌月、上下限、年またぎは維持する。
- 不正URLはクラッシュせずfallback表示になる。API request契約やURL正規化は変更しない。
- `MonthPicker`の他利用箇所とdefault sizeは変わらない。

## 受け入れ条件とテスト方針

| AC | 永続テスト / 確認 |
| --- | --- |
| AC-1 | MonthSelector test: locale-awareな1つのtrigger |
| AC-2 | implementation review: outer Flex `gap="3"`; desktop/mobile visual check |
| AC-3 | MonthSelector test: standard overlayのdata variant; ResponsiveOverlay既存test: dialog→sheet; mobile visual check |
| AC-4 | 既存MonthPicker tests/large storyとoverlay内integration |
| AC-5 | MonthSelector test: select→URL/label→close→trigger focus |
| AC-6 | MonthSelector test: dismiss→close→trigger focus |
| AC-7 | 既存category、前後月、年またぎ、上下限tests |
| AC-8 | table-driven invalid/partial/out-of-range URL testsと既存useDateRange tests |
| AC-9 | diff review: API/query/MSW/他MonthPicker契約に差分なし |
| AC-10 | Summary test: waitForでprogressbar 3件の安定状態 |
| AC-11 | Web必須検証batchとdesktop/mobile visual check |

`browser-test` tag、Page story、Storybook設定は変更しないため、AGENTS.mdの条件上`web:test:storybook`は必須batchに追加しない。既存Payment Page storyまたは実画面を起動し、desktop/mobile viewportで標準overlay、余白、選択後close、focusを手動確認する。

## Build / Verifyへの入力

1. `MonthSelector`をcontrolled `ResponsiveOverlay`、`gap="3"`、`useDateRange`再利用へ変更する。
2. overlay選択handlerでURL更新とcloseを同じ操作として実行し、前後月handlerは維持する。
3. `MonthSelector.test.tsx`へ標準overlay、選択後close/focus、不正・未解決URL回帰を追加する。
4. `Summary.test.tsx`のprogressbar件数を安定状態待ちへ変更する。
5. `pnpm run web:format`後、`web:lint`、`web:format-check`、`web:typecheck`、`web:test:unit-integration`を同じbatchで実行する。
6. desktop/mobileで年月操作群、ResponsiveOverlay、選択後close/focus、不正URLをvisual/interaction確認する。
7. 差分がRequirements、最新policy、対象外境界と一致することを確認する。

## リスクと確認事項

- navigateとcloseは同じuser actionで開始する。testではURL、label、overlay不在、focusの最終安定状態をまとめて待つ。
- `useDateRange`は選択可能year範囲を検証しないため、`isAllowedMonth`との二段階checkを省略しない。
- 欠落URLは初期化hookが非同期に補完する。MonthSelector単体testではfallback、Pageでは補完後の通常状態を既存testと合わせて扱う。
- ResponsiveOverlayのmobile判定は共有componentが所有する。MonthSelector testへ同じmedia query実装を複製しない。
- PR #1622のunit shard失敗はSummary testの途中状態検証であり、修正後にunit/integration全体とCIを再確認する。

## Verification

このDesign Doc作成はdocumentation-onlyである。最新Requirements、既存`MonthSelector` / `ResponsiveOverlay` / `useDateRange` / tests、PR #1622 CI log、選択したrule-mapサブグラフと照合する。

## Rule / Policy Check

- RequirementsのFR-1〜FR-6とAC-1〜AC-11へ実装・test判断を追跡できる。
- Requirementsを変更せず、保存/確定、URL自動補正、新規component/依存を追加していない。
- 最新Web Design Rulesに従い、ボタン群`gap="3"`、プロダクト標準overlay、選択後close/focusを設計した。
- Web Test Policyに従い、不正・未解決URLと非同期安定状態を回帰対象にした。
- 共有componentとvalidation境界を再利用し、支払い画面外へ変更を波及させない。

## Stop条件

- Requirementsの修正または新しいユーザー操作が必要になる。
- 共有`ResponsiveOverlay`、`useDateRange`、支払い画面外の`MonthPicker`契約変更が必要になる。
- URL自動正規化や復帰UIの仕様追加が必要になる。
- 新規依存、DB/API/Auth/RLS/RPC、domain/query/cache変更が必要になる。
- Designまたは実装方針が選択したrule/policyに違反する、または違反の可能性がある。
