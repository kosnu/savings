---
title: "Design: よくある支払いCardを可視項目ラベルなしで構造化する"
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
  - Issue #1591のCard表示を実装、検証するとき
  - よくある支払い候補の主従、余白、操作semanticsを確認するとき
---

# Design: よくある支払いCardを可視項目ラベルなしで構造化する

## 1. 文書の位置づけ

- Requirements: `docs/ai-driven-development/workspaces/1591-frequent-payments/requirements.md`
- Cycle ID: `71984042-27B9-4460-9C75-DD91FAE9FB9F`
- Artifact lineage: `docs/ai-driven-development/workspaces/1591-frequent-payments/`
- Branch / PR: `issue-1591/frequent-payments`, PR #1602

この文書は同じcycleの最新Requirementsを実装方針へ展開する。Requirementsはread-onlyとし、この文書の都合で要求を追加または変更しない。

## 2. Inputs

### 対象コード

- `FrequentPaymentSuggestions/FrequentPaymentSuggestions.tsx`
- `FrequentPaymentSuggestions/FrequentPaymentSuggestions.module.css`
- `FrequentPaymentSuggestions/FrequentPaymentSuggestions.test.tsx`

### 変更不要として確認するコード

- `FrequentPaymentSuggestions/FrequentPaymentSuggestions.stories.tsx`
  - Defaultが通常Cardと長いメモ、Loading / Empty / Error / Disabledが主要状態を表現済み。
- `apps/web/src/i18n/resources.ts`
  - 支援技術向け候補操作名は可視表示ではなく、操作と3値を理解するために利用する。
- `CreatePaymentForm/CreatePaymentForm.test.tsx`
- `CreatePaymentModal/CreatePaymentModal.test.tsx`
  - accessible nameと既存選択境界を利用しており、可視項目ラベルの削除による変更は不要。

### 維持する既存境界

- Card surfaceとnative buttonによるpointer / keyboard / disabled semantics。
- Headingと候補groupのprogrammatic relation。
- 候補の抽出、順序、件数、Book、期間、cache、invalidation。
- 候補選択による3field置換、非submit、日付維持、編集可能性。
- loading、error、empty時の非表示、refetch復帰、連続作成。

## 3. Rule Selection

### 作業分類

- path: `apps/web/src/features/payments/createPayment/**`
- domain: `payment`, `amount`, `category`, `web-ui`
- activity: `change_payment_ui`, `change_component_test`
- topic: `frequent-payments`, `card`, `typography`, `accessibility`

### Selected nodes

- `ai-driven.workflow`
  - Designの責務、上流artifactのread-only境界、Stop条件。
- `web.design-system-brand`
  - 日常の支払い登録を落ち着いた道具として見せる。
- `web.design-rules`
  - Card、token余白、主情報と補助情報の文字階層、responsive。
- `web.domain-ui-rules`
  - メモ、金額、カテゴリを候補識別のための値として扱う。
- `web.component-structure`
  - 既存component境界と主要状態Storyを維持する。
- `web.feature-directory`
  - `createPayment` slice内の既存配置を維持する。
- `web.test-policy`
  - component Story再利用とユーザーに残る表示・操作の回帰テスト。
- `web.storybook-browser-tests`
  - leaf component Storyをbrowser-test対象へ追加しない。
- `web.msw-handlers`
  - 既存handlerによる状態表現を維持する。

### Depends-on nodes

- `domain.payment`: メモ、金額、任意カテゴリの支払い値。
- `domain.amount`: 0を含む整数金額。
- `domain.category`: 実在カテゴリとカテゴリ未設定のデータ上の区別。
- `documentation.policy`: Design Docのfront matterと責務。

### Conflict decision

- Requirementsの「可視項目ラベルを追加しない」を優先し、`web.design-rules`のフィールドラベル階層をCardへ適用しない。このCardは入力fieldやkey-value詳細ではない。
- Cardの可視表示とaccessible nameは別の責務として扱う。支援技術向けの項目名は可視項目ラベルに当たらない。

## 4. Domain Value UI Decisions

| 値 | 利用目的 | 表示判断 |
| --- | --- | --- |
| メモ | 候補の主対象を識別する | Card上段へ標準本文相当、medium weightで表示する。可視`Note / メモ`は付けない。 |
| 金額 | 候補を識別し入力値を再利用する | Card下段へ小さいgrayの通貨表記で表示する。可視`Amount / 金額`は付けない。 |
| カテゴリ | 候補を識別し分類を再利用する | Card下段へ金額と分離した小さいgrayの値として表示する。可視`Category / カテゴリ`は付けない。 |
| カテゴリなし | 有効な分類値として候補を識別する | 既存の`None / なし`をカテゴリ値として表示する。特別な補助ラベルを追加しない。 |
| 操作名と3値 | 支援技術で候補の操作と内容を理解する | 既存accessible nameへ項目名と値を含める。画面には描画しない。 |

値なし、loading、error、候補0件は既存どおり候補領域全体を非表示にする。金額0は通貨表記の補助値、カテゴリなしは既存文言の補助値として表示し、未取得やerrorと混同しない。

## 5. 採用する実装方針

### 5.1 Cardと操作semantics

既存のRadix Themes `Card asChild size="1" variant="surface"`とnative `button type="button"`を維持する。

- Cardがsurface、角丸、内側余白を所有する。
- native buttonがpointer、Enter、Space、focus、disabledを所有する。
- Button component、pill形状、状態badgeへ戻さない。
- Headingとsemantic groupの関係を維持する。
- 通常surfaceへ独自shadow、独自色、固定heightを追加しない。

### 5.2 Card内の可視情報構造

Card内を次の2段にする。

1. 上段: 保存済みメモ。
   - `Text size="2" weight="medium"`。
   - 主情報として単独の行に置く。
2. 下段: 金額とカテゴリ。
   - それぞれ`Text size="1" color="gray"`。
   - 同じ`Flex`内で`gap`により別の値として分ける。
   - 狭幅ではwrapを許可する。

`Note / メモ`、`Amount / 金額`、`Category / カテゴリ`を描画する3つのlabel-value wrapperは削除する。値を一つの文字列へ連結せず、各`Text`を別要素のまま保つ。

候補全体は内容幅でwrapし、`max-width: 100%`と長文折り返しを維持する。Cardの左右内側余白はRadix `Card size="1"`に任せ、button側へ独自paddingを重ねない。

### 5.3 Accessible name

既存`payments.create.frequent.select`を変更しない。

- English: `Use frequent payment: Note {{note}}, Amount {{amount}}, Category {{category}}`
- Japanese: `よくある支払いを使用: メモ {{note}}、金額 {{amount}}、カテゴリ {{category}}`

これは支援技術へ操作名と3値の関係を伝える非可視名であり、Card内へ可視項目ラベルを追加するものではない。

### 5.4 CSS

- `.group`のfieldset resetを維持する。
- `.candidate`のnative button reset、幅、折り返し、左揃え、cursorを維持する。
- `.candidate:disabled`を維持する。
- label-value wrapper用の`.field`は削除する。
- `.value`はメモ、金額、カテゴリの長文折り返しに共用する。
- Card surface、hover、focus-visibleはRadix側に任せる。

### 5.5 Story

Storyファイルは変更しない。

- Default: 通常Cardと長いメモのwrap。
- Loading: 候補領域非表示。
- Empty: 候補領域非表示。
- Error: 候補領域非表示。
- Disabled: Card表示と操作不可。

leaf componentで同名testが操作を検証するため、`browser-test` tagは追加しない。

## 6. 変更対象

| ファイル | 変更 |
| --- | --- |
| `FrequentPaymentSuggestions.tsx` | 3つの可視項目ラベルとlabel-value wrapperを削除し、メモ上段・金額/カテゴリ下段へ再構成する。 |
| `FrequentPaymentSuggestions.module.css` | 不要になる`.field` selectorを削除し、値の折り返しを維持する。 |
| `FrequentPaymentSuggestions.test.tsx` | Cardの3値、可視項目ラベル不在、group、pointer / keyboardを検証する。 |

Requirements、Design Doc以外のドキュメント、Story、i18n、fetch、集計、query、フォーム、handlerは変更しない。

## 7. 採用しない案

- Card内の`Note / Amount / Category`を残す。
  - Requirementsの明示制約に反し、指摘を「項目名不足」へ再解釈するため。
- メモ、金額、カテゴリを1つの文字列として連結する。
  - Buttonラベルへ全情報を詰め込んだ状態へ戻り、値ごとの配置と主従を表現しにくいため。
- 金額とカテゴリをbadgeにする。
  - 値を状態表示に見せ、操作Card内で視覚要素を増やすため。
- Cardを`div`にしてkeyboard handlerを手動実装する。
  - native button semanticsを再実装し、disabledやkeyboard挙動の欠落リスクを増やすため。
- accessible nameから項目名を削除する。
  - 可視表示の密度問題を解決せず、支援技術が3値の関係を理解する情報だけを失うため。
- 新しいcomponent、Story、i18n keyを追加する。
  - 既存境界で要求を満たせるため。

## 8. テスト方針

### Component test

- AC-8, AC-9, AC-10:
  - candidateがCardとしてメモ、金額、カテゴリの値を含む。
  - `Note`、`Amount`、`Category`の可視テキストがcandidate内に存在しない。
  - 候補群が`Frequent payments`をaccessible nameに持つgroupである。
- AC-11:
  - candidateはbutton roleを持ち、pointer clickとEnterで`onSelect`を呼ぶ。
  - accessible nameに操作名と3項目の名前・値を含む。
- 同じメモの候補:
  - 金額とカテゴリの値によって選択前に候補を区別できる。
- AC-14, AC-15, AC-16:
  - Loading / Empty / Error、refetch成功、disabledの既存testを維持する。

### 既存回帰

- `CreatePaymentForm.test.tsx`: accessible nameが変わらないため変更不要。3field置換、日付維持、非submit、編集可能、送信中disabledの既存testを維持する。
- `CreatePaymentModal.test.tsx`: accessible nameが変わらないため変更不要。連続作成後の再評価とresetの既存testを維持する。
- domain / fetch tests: 取得・集計を変更しないため変更不要。

### 実画面

- Storybook Defaultを375px幅で確認する。
- Cardの左右余白、メモと補助値の2段階、長文wrap、focus-visibleを確認する。
- `Note / Amount / Category`が可視表示されないことを確認する。

## 9. 受け入れ条件との対応

| AC | 対応 |
| --- | --- |
| AC-1〜AC-7 | 取得・集計を変更せず、既存domain / integration testを維持。 |
| AC-8 | Card sizeとStorybook実画面で内側余白を確認。 |
| AC-9 | メモ上段medium、金額/カテゴリ下段grayとして実装・実画面確認。 |
| AC-10 | component testと実画面で可視項目ラベル不在を確認。 |
| AC-11 | native buttonのclick / Enter testを維持。 |
| AC-12〜AC-13 | Form回帰testを維持。 |
| AC-14〜AC-16 | component状態testを維持。 |
| AC-17 | Modal連続作成testを維持。 |
| AC-18 | diff reviewでDB/API/Auth/RLS/依存変更がないことを確認。 |

## 10. 既存挙動への影響

- 候補の抽出条件、順序、件数、Book/date境界は変えない。
- 候補選択後に置換するfield、非submit、日付維持は変えない。
- loading/error/empty時にフォームを利用できる挙動は変えない。
- query key、cache invalidation、連続作成の再取得順序は変えない。
- Card surface、内側余白、候補group、操作semanticsは変えない。
- 可視表示だけが、項目ラベル付き3ブロックから、メモと補助値の2段構造へ変わる。

## 11. リスクと確認事項

- 可視項目ラベルを削除した後も、金額は通貨表記、カテゴリは別`Text`とgapで識別できることを実画面で確認する。
- 長いメモと長いカテゴリが親幅を超えず、補助値のwrapで主従が崩れないことを確認する。
- Cardのfocus-visibleが認識でき、hoverだけに操作可能性を依存しないことを確認する。
- accessible nameは可視表示と分離して維持し、支援技術向けの情報を減らさない。
- API返却上限はRequirementsの運用前提に従い、実装・テスト対象へ戻さない。

## 12. Verification

Design工程ではアプリ検証を実行しない。Requirements、選択ルール、現行実装、ACとテスト方針の対応、`git diff --check`を確認する。
