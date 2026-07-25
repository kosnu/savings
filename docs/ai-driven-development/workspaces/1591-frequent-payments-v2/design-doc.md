---
title: "Design: よくある支払い候補をCard選択UIへ変更する"
doc_type: design
status: accepted
area: web
applies_to:
  - apps/web/src/features/payments/createPayment
topics:
  - ai-driven-development
  - design-doc
  - payments
  - frequent-payments
  - card
  - accessibility
  - storybook
when_to_read:
  - Issue #1591のレビュー後改善を実装、検証するとき
  - よくある支払い候補のCard構造、表示ラベル、状態Storyを確認するとき
---

# Design: よくある支払い候補をCard選択UIへ変更する

## 1. 文書の位置づけ

- Requirements: `docs/ai-driven-development/workspaces/1591-frequent-payments-v2/requirements.md`
- Cycle ID: `14221d02-7b08-44e2-ba12-b391d62bb3cc`
- Artifact lineage: `docs/ai-driven-development/workspaces/1591-frequent-payments-v2/`
- Branch / PR: `issue-1591/frequent-payments`, PR #1602

この文書はv3 Requirementsを実装方針へ展開する。Requirementsはread-onlyとし、この文書の都合で要求を追加または変更しない。

## 2. Inputs

### 対象コード

- `FrequentPaymentSuggestions/FrequentPaymentSuggestions.tsx`
- `FrequentPaymentSuggestions/FrequentPaymentSuggestions.module.css`
- `FrequentPaymentSuggestions/FrequentPaymentSuggestions.stories.tsx`
- `FrequentPaymentSuggestions/FrequentPaymentSuggestions.test.tsx`
- `apps/web/src/i18n/resources.ts`

### 回帰確認する既存境界

- `CreatePaymentForm/CreatePaymentForm.test.tsx`
  - 候補選択が3fieldだけを置換し、自動submitしないこと。
- `CreatePaymentModal/CreatePaymentModal.test.tsx`
  - 連続作成後の候補再評価とフォームreset。
- `frequentPayment.test.ts`
  - rolling期間、完全一致、閾値、順位、最大5件。
- `fetchFrequentPayments.integration.test.ts`
  - default Bookと期間filter、relation response。

取得・集計・query key・invalidation・フォーム値置換の実装は変更対象にしない。

## 3. Rule Selection

### 作業分類

- path: `apps/web/src/features/payments/createPayment/**`, `apps/web/src/i18n/resources.ts`
- domain: `payment`, `amount`, `category`, `web-ui`
- activity: `change_payment_ui`, `change_form`, `change_component_story`, `change_test`
- topic: `frequent-payments`, `card`, `accessibility`, `storybook`

### Selected nodes

- `ai-driven.workflow`
  - Designの責務、上流artifactのread-only境界、Stop条件。
- `web.design-system-brand`
  - 日常的な支払い登録を落ち着いた道具として見せる。
- `web.design-rules`
  - Card、token余白、文字階層、responsive、操作集合のprogrammatic relation。
- `web.domain-ui-rules`
  - メモ、金額、カテゴリを候補識別のための値として扱う。
- `web.component-structure`
  - 既存component境界を維持し、非表示loading状態にもStoryを用意する。
- `web.test-policy`
  - component Story再利用とユーザーに残る挙動の回帰テスト。
- `web.storybook-browser-tests`
  - leaf component Storyをbrowser-test対象へ自動追加しない。
- `web.msw-handlers`
  - 既存payment handlerのdelay optionでloadingを表現する。

### Depends-on nodes

- `domain.payment`: メモ、金額、任意カテゴリの支払い値。
- `domain.amount`: 0を含む整数金額。
- `domain.category`: 実在カテゴリとカテゴリ未設定のデータ上の区別。
- `web.feature-directory`: `createPayment` slice内の既存配置を維持する。
- `documentation.policy`: Design Docのfront matterと責務。

### Conflict decision

- Cardを視覚表現、native buttonを操作semanticsとして組み合わせる。Button componentのvariantでCard風に寄せない。
- 同名のシステムラベルと実在カテゴリはデータ上の値を維持し、表示文言、accessible name、visual styleによる特別な衝突対策は追加しない。

## 4. 現状と変更境界

現状はRadix Themes `Button`の`soft`、`size="1"`、`radius="full"`を候補全体へ適用し、1行目にメモ、2行目に`金額 · カテゴリ`を表示している。操作semanticsは適切だが、pill状Buttonの密度とラベルなしの値並びがv3 Requirementsを満たさない。

変更は候補の表示構造、見出しとの関係、状態Story、対応テスト、i18n文言に限定する。候補配列、選択callback、disabled入力、非表示条件は維持する。

## 5. 採用する実装方針

### 5.1 Cardと操作semantics

各候補はRadix Themes `Card`の`asChild`を使い、そのchildをnative `button type="button"`にする。

```tsx
<Card asChild size="1" variant="surface">
  <button type="button" disabled={disabled} ...>
    ...
  </button>
</Card>
```

- `Card`がsurface、角丸、`--space-3`相当の内側余白を所有する。
- native buttonがpointer、Enter、Space、focus、disabledのsemanticsを所有する。
- Button componentの`soft`、`radius="full"`は使わない。
- candidate classはbrowser既定button appearanceをresetし、Cardのsurfaceを上書きしない。
- `max-width: 100%`、長文折り返し、左揃えを維持する。
- hover、focus-visible、disabledは既存tokenを使う。通常surfaceへ独自shadowや独自色を追加しない。

Cardは候補内容に応じた幅でwrapし、モバイルでは親幅を超えない。固定heightは設けない。

### 5.2 Card内の情報構造

Card内は次の順序で縦方向に構成する。

1. `Note / メモ`の小さいgrayラベル。
2. 保存済みメモの主情報。標準本文以上、medium weight。
3. 金額とカテゴリの2つのlabel-value pair。
   - `Amount / 金額`ラベルと通貨表記値。
   - `Category / カテゴリ`ラベルとカテゴリ名または`None / なし`。

金額とカテゴリは`Flex`で横並びにし、狭幅ではwrapを許可する。ラベルは`size="1"`かつgray、値は`size="2"`を基本とし、メモより強くしない。

既存i18nの次のkeyをvisible labelへ再利用する。

- `payments.note.label`
- `amount.label`
- `payments.category.label`
- `payments.category.none`

新しいvisible文言keyは追加しない。

### 5.3 Accessible name

既存`payments.create.frequent.select`を次の内容へ更新する。

- English: `Use frequent payment: Note {{note}}, Amount {{amount}}, Category {{category}}`
- Japanese: `よくある支払いを使用: メモ {{note}}、金額 {{amount}}、カテゴリ {{category}}`

Card内のvisible labelと同じ項目名をaccessible nameにも含める。カテゴリ未設定と同名の実在カテゴリに対する追加語や別表現は入れない。

### 5.4 見出しと候補操作群

`useId()`で見出しIDを生成する。

- 見出しはRadix Themes `Heading as="h3" size="2"`で表示する。
- 候補をwrapする`Flex`へ`role="group"`と`aria-labelledby={headingId}`を付ける。
- 見出し自身へ`id={headingId}`を付ける。

これにより、視覚的な「Frequent payments / よくある支払い」と候補操作群の関係をprogrammaticに表現する。新しいユーザー操作は追加しない。

### 5.5 状態

既存状態を次のまま維持する。

| 状態 | 候補領域 |
| --- | --- |
| sessionなし | 非表示 |
| default Book loading/error | 非表示 |
| 候補loading/error/empty | 非表示 |
| 候補success | 見出しと最大5件のCard |
| submitting | Card表示を維持し、全候補disabled |
| error後のrefetch成功 | 同じ境界でCardを再表示 |

`Loading` Storyを追加し、`createPaymentHandlers({ get: { durationOrMode: "infinite" } })`で候補queryをpendingに保つ。Storyは候補領域が非表示になる状態を単独確認するためのもので、`browser-test` tagは付けない。

## 6. 変更対象

| ファイル | 変更 |
| --- | --- |
| `FrequentPaymentSuggestions.tsx` | ButtonをCard + native buttonへ変更。visible labels、Heading、group relationを追加。 |
| `FrequentPaymentSuggestions.module.css` | native button reset、Card幅、折り返し、focus-visible、hover、disabledを定義。 |
| `FrequentPaymentSuggestions.stories.tsx` | infinite delayを使う`Loading` Storyを追加。 |
| `FrequentPaymentSuggestions.test.tsx` | Card内ラベル、group accessible name、pointer/keyboard、loading Storyを検証。 |
| `apps/web/src/i18n/resources.ts` | 候補操作のaccessible nameへ項目名を追加。 |

新しいcomponent、hook、query、handler option、依存は追加しない。

## 7. 採用しない案

- Radix `Button`へpaddingだけ追加する。
  - Button風表示を維持し、Cardとして内容を読む要求を満たさない。
- Card全体を`div`にし、`onClick`と`tabIndex`、keyboard handlerを手動実装する。
  - native button semanticsを再実装する必要があり、disabledやkeyboard挙動の欠落リスクがある。
- Card内に別のButtonを配置する。
  - Cardと選択操作が二重に見え、操作領域も分かれる。
- `PaymentCard`を再利用する。
  - 支払い一覧向けのdate、chevron、強い金額階層を持ち、候補識別の情報順と責務が異なる。
- loading用の新しいMSW handlerを追加する。
  - 既存payment handlerのdelay optionで表現できる。
- 候補Storyへ`browser-test` tagを付ける。
  - leaf componentであり、同名component testで操作を検証できる。

## 8. テスト方針

### Component test

- AC-8, AC-9:
  - Card内に`Note / Amount / Category`と各値が表示される。
  - メモ、金額、カテゴリの長文が候補から失われない。
- AC-10:
  - candidateはbutton roleを持ち、pointer clickとEnterで`onSelect`を呼ぶ。
  - accessible nameに操作名と3項目の名前・値を含む。
- `web.design-rules`:
  - 候補群が`Frequent payments`をaccessible nameに持つgroupになる。
- AC-13:
  - `Loading` Storyで候補領域を表示しない。
  - Empty、Errorの既存testを維持する。
- AC-14, AC-15:
  - error後refetch成功で再表示し、disabled時に選択できない既存testを維持する。

### 既存回帰

- `CreatePaymentForm.test.tsx`: 3field置換、日付維持、非submit、編集可能、送信中disabled。
- `CreatePaymentModal.test.tsx`: 連続作成後の再評価とreset。
- domain / fetch tests: rolling期間、候補集計、default Book filter。

### Story

- Default: Card表示と長いメモのwrap。
- Loading: 候補領域非表示。
- Empty: 候補領域非表示。
- Error: 候補領域非表示。
- Disabled: Card表示と操作不可。

## 9. 既存挙動への影響

- 候補の抽出条件、順序、件数、Book/date境界は変えない。
- 候補選択後に置換するfield、非submit、日付維持は変えない。
- loading/error/empty時にフォームを利用できる挙動は変えない。
- query key、cache invalidation、連続作成の再取得順序は変えない。
- visible UIはpill状Buttonから小さめCardへ変わり、項目ラベルを追加するため候補1件あたりの高さは増える。
- Cardは最大5件かつwrap可能であり、モバイルでは横スクロールを発生させない。

## 10. リスクと確認事項

- `Card asChild`でnative buttonへCard classを適用した際、browser既定appearanceがCard surfaceを上書きしないようCSS resetを確認する。
- focus-visibleがCard輪郭として認識でき、hoverだけに操作可能性を依存しないことをStorybookで確認する。
- visible label追加後も長いメモ、長いカテゴリ、通貨表記が親幅を超えないことを確認する。
- 候補群のHeading levelはフォーム内の既存見出し階層へ接続するため`h3`とする。ページタイトル級へ上げない。
- API返却上限はRequirementsの運用前提に従い、実装・テスト対象へ戻さない。

## 11. Verification

Design工程ではアプリ検証を実行しない。Requirements、選択ルール、実装可能性、ACとテスト方針の対応、`git diff --check`を確認する。
