---
title: "Design: よくある支払いを入力候補として再利用できるようにする"
doc_type: design
status: accepted
area: web
applies_to:
  - apps/web/src/features/books
  - apps/web/src/features/payments/createPayment
  - apps/web/src/features/payments/queryKeys.ts
  - apps/web/src/test/msw/handlers
topics:
  - ai-driven-development
  - design
  - payments
  - frequent-payments
  - book
  - react-query
  - form
when_to_read:
  - Issue #1591の「よくある支払い」を実装・検証するとき
  - default Book取得と支払い候補queryの接続を確認するとき
---

# Design: よくある支払いを入力候補として再利用できるようにする

## 1. 文書の位置づけ

- Initial input: GitHub Issue #1591
- Requirements: `docs/ai-driven-development/workspaces/1591-frequent-payments-v2/requirements.md`
- Cycle ID: `d30893e2-55c4-4e11-8a6d-3f6eae8a94e4`
- Artifact lineage: `docs/ai-driven-development/workspaces/1591-frequent-payments-v2/`
- Related future work: GitHub Issue #1601

この文書は、同じlineageのRequirementsを実装へ変換する設計正本である。前サイクルのRequirementsとDesign Docは入力として扱わない。

## 2. 設計概要

支払い作成フォーム内の独立した候補コンポーネントが、認証ユーザーのdefault Bookをbooks featureの公開hookから取得し、そのBook IDとフォームを開いた日のrolling期間を使って候補queryを実行する。

候補queryは`book_id`と期間を明示的に絞り、カテゴリrelationを含む行を検証した後、メモ・金額・カテゴリIDの完全一致で集計する。候補取得はoptional enhancementとして通常の`useQuery`状態を観測し、未取得・loading・error・emptyでは何も表示しない。成功後は、メモを主表示、金額とカテゴリを補助表示にしたbuttonを最大5件表示する。

候補選択はフォームのメモ・金額・カテゴリだけを置換する。作成成功後は既存のpayments root invalidationを利用し、保存済み行を再取得して候補を再集計する。

## 3. Rule Selection

### 作業分類

- path: `apps/web/src/features/books/**`, `apps/web/src/features/payments/**`, `apps/web/src/test/msw/handlers/**`
- domain: `book`, `payment`, `amount`, `date`, `category`, `web-ui`
- activity: `change_query`, `change_cache_invalidation`, `change_async_loading`, `change_component`, `change_test`
- topic: `frequent-payments`, `react-query`, `error-recovery`, `form`, `msw`

### Selected nodes

- `ai-driven.workflow`: phaseと成果物境界。
- `domain.book` / `domain.user`: default Bookの暫定操作境界とmembership認可の区別。
- `domain.payment` / `domain.amount` / `domain.date` / `domain.category`: 支払い行、0円、date-only、カテゴリなしの値境界。
- `policy.temporal-data`: rolling期間とローカル日付。
- `web.domain-ui-rules` / `web.design-rules`: 候補の識別情報、主従、button、状態表現。
- `web.component-structure` / `web.feature-directory`: 候補コンポーネントとfeature間公開面。
- `web.query-cache`: 保存済みデータの再取得とcache非直接更新。
- `web.suspense-boundaries`: optional表示のloading/error/recovery方式。
- `web.msw-handlers` / `web.test-policy`: API意味の検証とstateful integration test。

### Depends-on nodes

- `web.domain-layer-rules`: 金額表示は既存共通formatterを再利用し、feature固有集計はcreatePayment sliceに置く。
- `web.storybook-browser-tests`: component Storyへ`browser-test` tagを付けない。

### Conflict decision

- 現在はdefault Bookを唯一の選択中Bookとして明示filterする。
- RLSのmembership境界だけに候補範囲を委ねない。
- 共通の選択中Book contextと支払いCRUD全体の境界変更は#1601へ残す。

## 4. 変更対象と責務

### books feature

- `features/books/index.ts`
  - `useCurrentBook`と必要な型をfeature公開面からexportする。
- `bookSettings/useCurrentBook.ts`
  - 既存の`promise`に加え、optional表示がSuspense外で状態を観測できる`book`、`isPending`、`isError`を返す。
  - query keyは認証ユーザーIDを含む既存keyを維持する。
- `bookSettings/CurrentBookInformation/**`
  - 既存consumerの表示挙動は変更しない。

paymentsから`books/bookSettings/**`を直接importせず、`features/books`の公開面だけに依存する。

### payments createPayment slice

- `frequentPayment.ts`
  - rolling期間、候補型、完全一致集計、閾値、最大件数、決定的順位を所有する。
  - `FrequentPayment`へ表示用`categoryName: string | null`を持たせる。
  - tie-breakerは`count`降順、`note`昇順、`amount`昇順、`categoryId`のnull先頭・数値昇順とする。
- `fetchFrequentPayments.ts`
  - 引数を`{ bookId, startDate, endDate }`にする。
  - `payments`へ`book_id = bookId`、`date >= startDate`、`date <= endDate`を送る。
  - `book_id, note, amount, category_id`と、カテゴリの`id, book_id, name`を取得する。
  - responseで支払いのBook ID、カテゴリID、カテゴリのBook IDが引数と整合することを検証する。不整合は空候補ではなくerrorにする。
- `useFrequentPayments.ts`
  - query keyへ`bookId/startDate/endDate`を含める。
  - `useQuery`の`data/isPending/isError`を返し、promiseをUIの唯一の読み取り経路にしない。
- `FrequentPaymentSuggestions/**`
  - 認証ユーザーIDがない、default Book未取得、いずれかのqueryがloading/error、候補0件の場合は`null`。
  - default Book成功後だけ候補queryをmountする。
  - error時にもquery observerをmountしたままにし、invalidation等の後続refetch成功で通常表示へ戻す。
  - `Suspense`と`ErrorBoundary`は使わない。候補がフォームを阻害せず、error fallbackでobserverを失わず自動復帰することを優先するための、`web.suspense-boundaries`に対する明示的な例外とする。
- `CreatePaymentForm/**`
  - 候補選択で既存form instanceの`note`、`amount`、`category`だけを更新する。
  - `isSubmitting`を候補buttonの`disabled`へ渡す。
- `queryKeys.ts`
  - frequent keyを`["payments", "frequent", bookId, startDate, endDate]`とする。
  - `paymentQueryKeys.all` prefix配下を維持し、既存mutation成功後のroot invalidation対象に含める。

### test infrastructure

- `test/msw/handlers/books.ts`
  - 既存default Book handlerを候補component/storyでも使う。
- `test/msw/handlers/payments.ts`
  - category relationを選択したresponse shapeに対応する。
  - 連続作成テストに限り、POSTした行を後続GETへ反映できる明示optionを追加する。
  - handlerへ候補集計、順位、閾値ロジックを持たせない。

## 5. データフロー

1. 候補コンポーネントmount時にローカル`Date`を一度だけ固定する。
2. sessionの認証ユーザーIDで既存current Book queryを観測する。
3. default Book取得成功後、Book IDと固定日から候補query key・期間を作る。
4. SupabaseからBook・期間を明示filterした行とカテゴリrelationを取得する。
5. response境界を検証し、純粋関数で候補を集計する。
6. 成功かつ1件以上なら候補buttonを表示する。
7. 選択時に3fieldだけを置換する。
8. 支払い作成成功時、既存mutationが`paymentQueryKeys.all`をinvalidateし、activeな候補queryをrefetchする。
9. source of truthの再取得成功後に既存`onSuccess`へ進み、連続作成ならフォームをresetする。

cacheへ候補を手動追加せず、未保存値を件数へ含めない。

## 6. Domain Value UI Decisions

| 値 | 目的 | 主な表示 |
| --- | --- | --- |
| メモ | 候補対象の識別 | button内の先頭・強い文字階層。保存値をそのまま表示する。 |
| 金額 | 同一メモ候補の識別、入力再利用 | `toCurrency`による補助文字。0円も`¥0`として表示する。 |
| カテゴリ | 同一メモ・金額候補の識別、入力再利用 | relation名。nullは既存`payments.category.none`を表示する。 |
| 頻度 | 順位判断 | 表示せず並び順だけに使う。 |
| default Book | 操作対象限定 | UIには表示せずquery条件にする。 |

候補buttonは、1行目にメモ、2行目相当の弱い文字階層に`金額 · カテゴリ`を置く。長いメモはbutton内で折り返す。accessible nameは新しいi18n文言`Use frequent payment: {{note}}, {{amount}}, {{category}}` / `よくある支払いを使用: {{note}}、{{amount}}、{{category}}`とし、同一メモの候補を名前でも区別する。

見出しは既存`Frequent payments` / `よくある支払い`を維持する。loading、error、empty用の文言とretry操作は追加しない。

## 7. 状態設計

| 状態 | 候補領域 | フォーム |
| --- | --- | --- |
| sessionなし | 非表示 | 既存親境界に従う |
| default Book loading/error | 非表示 | 利用可能 |
| 候補loading/error/empty | 非表示 | 利用可能 |
| 候補success | 最大5件表示 | 利用可能 |
| submitting | 表示維持、全候補disabled | 既存送信中挙動 |
| error後のrefetch成功 | 自動再表示 | 入力値を変更しない |
| 連続作成成功 | 保存行で再集計 | 既存default値へreset、continuous設定は維持 |

## 8. 採用しない案

- RLSだけで候補範囲を限定する: membership可能な全Bookと現在の操作対象を区別できない。
- payments内から`bookSettings/useCurrentBook.ts`を直接importする: feature公開面を破る。
- 候補query内でdefault Bookを毎回直接取得する: current Book cacheと責務が重複し、Book IDをquery keyへ確実に含めにくい。
- ErrorBoundaryの`fallback={null}`を維持する: error後に候補query observerを失い、後続refetch成功だけでは復帰できない。
- query cacheへ作成値を直接加算する: 保存前データを候補に含める可能性があり、source of truth方針に反する。
- memoだけをbuttonへ表示する: 同一memoの別候補を選択前に識別できない。
- 件数を表示する: Requirementsは順位付けだけを目的としており、新たな表示価値を追加する。

## 9. テスト計画

| Requirements | テスト境界 |
| --- | --- |
| AC-1, AC-2 | `frequentPayment.test.ts`: rolling両端、月末丸め |
| AC-3, AC-16 | `fetchFrequentPayments.integration.test.ts`: `book_id` filter、期間filter、relation select、response Book整合、error |
| AC-4〜AC-7 | `frequentPayment.test.ts`: 空メモ除外、完全一致、0円、カテゴリなし、閾値、順位、最大5件 |
| AC-8, AC-9 | `FrequentPaymentSuggestions.test.tsx`: 同一memo別候補の表示・accessible name、pointer/keyboard |
| AC-10, AC-11 | `CreatePaymentForm.test.tsx`: 3fieldだけ置換、非submit、日付維持、再編集 |
| AC-12 | 候補component/form test: default Book・候補のloading/error/emptyでも非表示かつform操作可能 |
| AC-13 | `FrequentPaymentSuggestions.test.tsx`: 初回error後、同じqueryの自動refetch成功で候補が再表示 |
| AC-14 | `CreatePaymentForm.test.tsx`: submitting中disabled |
| AC-15 | `CreatePaymentModal.test.tsx`: stateful MSWで3件目をPOSTし、再取得後に候補表示、amount/note/category/dateのreset、continuous設定維持 |

fetch integration testはselect文字列全体でなく、必要column/relation、`book_id`、date条件を個別に検証する。component testは既存Storyを再利用し、Storyへbooks handlerを追加する。新規component Storyに`browser-test` tagは付けない。

## 10. 既存挙動への影響

- 支払い作成payload、validation、作成button、キャンセル、通常作成時のcloseは変更しない。
- categories queryとfieldの編集方法は変更しない。
- current Book設定表示は同じqueryとpromiseを継続利用する。
- payments root invalidationは既存の一覧・集計に加えて候補queryも更新するが、追加invalidateは不要。
- 候補の取得失敗はフォームや支払い作成のerrorへ昇格させない。

## 11. リスクと確認結果

- current Bookと候補の2 queryにより初回候補表示は順次取得になるが、両方を独立cacheし、optional表示のためフォームを待たせない。
- category relationの不正・削除済みカテゴリはresponse不整合として候補領域を非表示にする。誤ったカテゴリをフォームへ設定しないことを優先する。
- error後の復帰はquery observerを維持する設計で可能であり、新しいretry UIは不要。
- 連続作成は既存の「invalidation完了後にonSuccess」の順序を利用でき、mutation境界変更は不要。
- DB/API/RLS/Auth変更、#1601の先行実装、新操作の追加は不要で、Stop条件には該当しない。

## 12. Verification

Design工程ではアプリ検証を実行しない。文書構造、RequirementsのAC、選択ルール、現行コードとの接続を確認する。
