---
title: "Design: 支払い操作を選択中Bookの境界へ統一する"
doc_type: design
status: accepted
area: web
applies_to:
  - apps/web/src/app/routes/PaymentsPage
  - apps/web/src/features/books
  - apps/web/src/features/payments
  - apps/web/src/test/msw/handlers
  - docs/harness/domain/book.md
  - docs/harness/domain/payment.md
topics:
  - ai-driven-development
  - design
  - book
  - payment
  - authorization
  - react-query
  - query-cache
when_to_read:
  - Issue #1601を実装または検証するとき
  - Payment CRUDへselected Book IDを伝播する設計を確認するとき
---

# Design: 支払い操作を選択中Bookの境界へ統一する

## 1. 文書の位置づけ

- Cycle ID: `AIDD-1601-20260728-01`
- Input: `docs/ai-driven-development/workspaces/1601-payment-selected-book-boundary/requirements.md`
- Output owner: Design / Plan Goal
- Input status: Requirementsはread-only

## 2. 設計目標

認証ユーザーのdefault Bookを現在のselected Bookとして一度解決し、そのBook IDをPayment featureの作成、一覧、詳細、更新、削除、よくある支払い候補、query cacheへ明示的に伝播する。

DB/RLSのmembership認可は変更せず防御境界として維持する。Web側では、アクセス可能なBook集合と現在の操作対象Bookを分離する。

## 3. Rule Selection

### 作業分類

- path: `apps/web/src/app/routes/PaymentsPage/**`, `apps/web/src/features/books/**`, `apps/web/src/features/payments/**`, `apps/web/src/test/msw/handlers/payments.ts`, `docs/harness/domain/{book,payment}.md`
- domain: `book`, `payment`, `user`, `amount`, `date`, `category`, `web-cache`
- activity: `change_payment_behavior`, `change_query`, `change_mutation`, `change_cache_invalidation`, `change_feature_boundary`, `add_test`, `update_doc`
- topic: `selected-book`, `authorization`, `payment`, `react-query`, `cache`, `regression`

### Selected nodes

- `ai-driven.workflow`: Designの責務とRequirementsのread-only境界。
- `domain.book`: default Book、membership、Book ownership。
- `domain.payment`: Payment ownership、CRUD、categoryの同一Book制約。
- `web.feature-directory`: 複数Bookユースケースで共有するquery/fetch/hookの配置と公開面。
- `web.component-structure`: 既存Page・Payment componentのprops変更とStory責務。
- `web.query-cache`: source of truth再取得とcache直接更新禁止。
- `web.suspense-boundaries`: 既存query.promise境界を維持するため。
- `web.test-policy`: API境界とユーザーに残る挙動の回帰テスト。
- `web.storybook-browser-tests`: PaymentsPage story変更時のbrowser test。
- `policy.transaction-boundaries`: update/deleteの1操作1変更と対象なし判定。
- `documentation.policy`: Design Docとdomain docsの責務・front matter。

### Depends-on nodes

- `ai-driven.overview`, `domain.user`, `domain.amount`, `domain.date`, `domain.category`。

### Conflict decision

- `domain.book`の暫定監督ルールに従い、現在はdefault Bookを唯一のselected Bookとする。
- Issue #1601は既存の複数membershipを明示的に対象とするため、membershipによるRLS結果だけでは操作対象を保証したことにしない。
- UI loading/errorの新しい文言や操作は追加しない。selected Book未解決時はPayment page content自体を実行・表示しない。

## 4. 採用する構成

### 4.1 selected Book取得をbooks featureの共有処理にする

現在`bookSettings` sliceにあるdefault Book取得処理は、Settings表示とPaymentsの両方で使うため、books feature rootへ移動してselected Bookとして命名する。

```text
apps/web/src/features/books/
  fetchSelectedBook.ts
  fetchSelectedBook.integration.test.ts
  selectedBookQueryKeys.ts
  useSelectedBook.ts
  index.ts
  bookSettings/
    CurrentBookInformation/
```

- `fetchSelectedBook`は現在と同じく`book_members.is_default = true`を1件取得し、membershipの`book_id`とjoined Bookの`id`一致を検証する。
- 型名は`SelectedBook`とする。
- `selectedBookQueryKeys.selected(authUserId)`は認証ユーザーごとにdefault Book取得cacheを分離する。
- `useSelectedBook(authUserId)`は既存どおり`book`, `isPending`, `isError`, `promise`を返す。
- books feature外からは`apps/web/src/features/books/index.ts`の公開面だけを使う。
- `CurrentBookInformation`は同じselected Book queryを利用し、表示名や既存loading/error表示は変えない。

### 4.2 PaymentsPageで一度解決し、propsで伝播する

`PaymentsPage`は認証sessionのuser IDを`useSelectedBook`へ渡し、解決した`book.id`をPaymentの2つの入口へ渡す。

```text
PaymentsPage
  selectedBook.id
  ├─ CreatePaymentModal(bookId)
  │    └─ CreatePaymentForm(bookId)
  │         ├─ useCreatePayment(bookId)
  │         └─ FrequentPaymentSuggestions(bookId)
  └─ PaymentList(bookId)
       ├─ usePayments(bookId)
       ├─ PaymentDetailsOverlay(bookId)
       │    ├─ usePaymentDetails(bookId)
       │    └─ Date/Amount/Category/NoteField(bookId)
       │         └─ useUpdatePayment(bookId)
       └─ DeletePaymentModal(bookId)
            └─ useDeletePayment(bookId)
```

- selected Bookがpending、error、未取得、または認証sessionがない間は`PaymentsPage`のPayment contentを返さず、Payment query / mutationを作らない。
- 新しいloading/error文言、retry、画面遷移は追加しない。
- selected Book解決後の画面構造・文言・操作は変えない。
- `Summary`と`PaymentCategoryFilter`の内部取得条件は変更しない。Page contentがselected Book解決後に表示される点だけが接続上の変化になる。
- React context/providerやlocal selected Book stateは追加しない。将来Book選択を導入するときは`useSelectedBook`の解決元を変更し、同じID伝播を維持できる。

### 4.3 Payment data関数へBook IDを必須入力として渡す

#### 作成

- `useCreatePayment(bookId, onSuccess?, onError?)`とprivate `postPayment(bookId, value)`にする。
- insert rowへ`book_id: bookId`を明示的に追加する。
- `PaymentWriteInput`とフォームschemaへBook IDを混ぜず、操作境界の値としてhookから付与する。

#### 一覧

- `usePayments(bookId, options?)`から`fetchPayments(bookId, dateRange, options?)`を呼ぶ。
- Supabase queryへ`.eq("book_id", bookId)`を追加する。
- mapping後のすべての`payment.bookId`が入力Book IDと一致することを検証し、不一致は`Invalid payments response`としてthrowする。

#### 詳細

- `usePaymentDetails(bookId, paymentId)`から`fetchPaymentDetails(bookId, paymentId)`を呼ぶ。
- Supabase queryへPayment IDとBook IDの両方のeq条件を付ける。
- 対象なしは既存どおり`null`とし、返却行のBook ID不一致は`Invalid payment details response`としてthrowする。

#### 更新

- `useUpdatePayment(bookId, ...)`から`updatePayment(bookId, paymentId, patch)`を呼ぶ。
- update payloadにはBook IDを含めず、queryへPayment IDとBook IDのeq条件を付ける。
- 1回のupdate chainへ`.select("id").maybeSingle()`を付け、返却IDが対象Payment IDと一致することを確認する。
- errorまたは対象なし/ID不一致はthrowし、既存のfield error/snackbar経路を使う。

#### 削除

- `useDeletePayment(bookId, ...)`から`removePayment(bookId, paymentId)`を呼ぶ。
- 1回のdelete chainへPayment IDとBook IDのeq条件、`.select("id").maybeSingle()`を付ける。
- errorまたは対象なし/ID不一致はthrowし、既存の削除失敗snackbar経路を使う。

update/deleteはそれぞれ単一行への単一DB操作であり、新しいtransaction/RPCは不要である。返却IDは操作対象の確認だけに使い、cacheを直接更新しない。

### 4.4 query keyをBookごとに分離する

`paymentQueryKeys`はprefixを維持しつつ、実データqueryの第2階層にBook IDを含める。

```ts
all                         // ["payments"]
book(bookId)                // ["payments", bookId]
list(bookId, scope, date, category)
frequent(bookId, start, end)
detailsAll                  // ["paymentDetails"]
detailsBook(bookId)         // ["paymentDetails", bookId]
details(bookId, paymentId)
```

- 一覧と候補は`book(bookId)` prefix配下にする。
- 詳細は`detailsBook(bookId)` prefix配下にする。
- `cacheScope`は同一Book内のPage instance分離として維持する。
- `invalidatePaymentMutationQueries(queryClient, bookId)`は対象Bookの`book(bookId)`と`detailsBook(bookId)`をinvalidateする。
- 既存の`summaryQueryKeys.totalExpendituresAll`と`categoryTotalsAll` invalidationは維持する。
- Category変更側が使う`paymentQueryKeys.all` / `detailsAll`は全Book prefixとして維持する。
- `setQueryData`やoptimistic updateは追加しない。

### 4.5 domain ruleを同期する

`docs/harness/domain/book.md`へ次を追加する。

- membershipは認可境界であり、selected Bookはアプリケーションの操作対象境界である。
- 現在はdefault Bookがselected Bookである。
- selected Book以外のBookへmembershipがあっても、現在の操作対象にはしない。

`docs/harness/domain/payment.md`へ次を追加する。

- WebのPayment作成・一覧・詳細・更新・削除・候補はselected Bookへ限定する。
- 作成はselected Bookを所有先として明示し、更新・削除はIDとselected Bookの両方で限定する。
- Payment cacheはselected Bookごとに分離する。

将来のBook選択UIやCategory/Budgetの境界は記述しない。

## 5. 変更対象

### books

- `bookSettings/{fetchCurrentBook,useCurrentBook,currentBookQueryKeys}`と取得integration testをbooks rootのselected Book名へ移動・改名する。
- `bookSettings/CurrentBookInformation`と関連testのimport/query keyを更新する。
- `features/books/index.ts`の公開面を`SelectedBook` / `useSelectedBook`へ更新する。

### PaymentsPageとPayment components

- `PaymentsPage.tsx`: sessionからselected Bookを解決し、Book IDをCreate/Listへ渡す。
- `PaymentPage.stories.tsx`, `PaymentsPage.test.tsx`: Book handler、Book ID query条件、selected Book loading/error状態を追加する。
- Create: Modal、Form、FrequentPaymentSuggestions、useCreatePaymentと関連story/test。
- List: PaymentList、usePayments、fetchPaymentsと関連story/test。
- Details: Overlay、4つのfield、usePaymentDetails、fetchPaymentDetailsと関連story/test。
- Update/Delete: hooks、data関数、modalと関連test。
- 共通: `queryKeys.ts`, `invalidatePaymentMutationQueries.ts`とhook tests。

### Test infrastructure

- `apps/web/src/test/msw/handlers/payments.ts`: create bodyのBook ID、GET/PATCH/DELETEのBook filter、update/deleteの返却IDを扱う。
- `apps/web/src/test/msw/handlers/books.ts`:既存handlerをPaymentsPage story/testで明示利用する。API shapeは変更しない。

### Docs

- `docs/harness/domain/book.md`
- `docs/harness/domain/payment.md`
- このworkspaceのRequirements / Design DocはBuild / Verifyでread-only。

## 6. 採用しない案

### React context/providerでselected Bookを保持する

現在はdefault Book以外の選択状態がなく、React Queryの取得結果とは別の状態を作る必要がない。アプリ全体providerへ広げると、対象外のCategory/Budgetや他Pageまで変更境界が拡大するため採用しない。

### 各Payment hookが個別にselected Bookを取得する

同じPage内で依存が暗黙化し、mutation関数やquery keyへどのBook IDを渡したか追跡しにくい。Pageで一度解決して明示的にprop伝播する。

### 現状どおりRLSとDB default補完だけへ依存する

membership認可と操作対象を分離できず、Requirementsの中心課題を満たさないため採用しない。

### update/delete前に詳細を別queryで取得する

確認とmutationの間に競合が入り、2回のAPI操作になる。Book ID条件をmutation自体へ含め、返却IDで単一操作の結果を確認する。

### cacheを直接書き換える

server source of truthと乖離するため採用しない。対象Book prefixをinvalidateして再取得する。

## 7. 既存挙動への影響

- default Bookだけを利用する通常操作では、表示、入力項目、文言、作成・編集・削除手順は変わらない。
- 初回はselected Book解決後にPayment page contentを表示する。未解決/error時にPayment query/mutationを実行しないため、Page固有の新しい表示は追加しない。
- よくある支払いの期間、集計、Card、選択挙動は変わらず、Book IDの供給元だけがPage共通境界になる。
- 詳細URLが別BookのPayment IDを指す場合は既存not found表示になる。
- 別Bookまたは存在しないPaymentへの更新・削除は既存failure表示経路になる。
- Summary、Category filter、Budgetのquery仕様は変更しない。

## 8. テスト方針

### selected Book

- fetchがdefault membershipとjoined Book ID一致を要求する既存integration testを移動・改名する。
- CurrentBookInformationのDefault/Loading/Errorを既存Story/testで維持する。
- PaymentsPageはselected Book取得前/error時にPayment APIを呼ばず、解決後にBook IDをPayment操作へ渡すことを確認する。

### API境界

- create request bodyに`book_id`があり、既存フォーム値が維持される。
- list GETに`book_id=eq.<selected>`があり、レスポンスBook不一致をthrowする。
- details GETにPayment IDとBook IDがあり、別Book対象はnull、レスポンス不一致はthrowする。
- update PATCH/delete DELETEにPayment IDとBook IDがあり、payloadにBook IDがなく、対象なし/不一致はthrowする。
- frequent GETの既存Book条件・レスポンス検証を維持する。

### query/cache

- query key unit testで、同条件のBook 42/43のlist/details/frequentが異なることを確認する。
- create/update/delete hook testsで対象Book prefixと既存Summary prefixのinvalidationを確認する。
- Book IDが変わるとlist/detailが別queryとして取得されることをhook testで確認する。

### component/Page

- prop追加に伴う既存Story/test fixtureをBook ID 1で更新する。
- 詳細update/deleteの成功・失敗表示を既存テストで維持する。
- `PaymentPage.stories.tsx`は`browser-test`対象なのでBook handlerを追加し、既存Default/OpenDetails playを維持する。

## 9. 受け入れ条件との対応

| Requirements | 設計・テスト |
| --- | --- |
| AC-1, AC-2 | `useSelectedBook`をPaymentsPageで解決し、未取得時はPayment contentを実行しない |
| AC-3 | create hook/data関数へBook ID、insert body検証 |
| AC-4 | listのBook eq条件とresponse検証 |
| AC-5 | detailsのID+Book条件、別Booknull |
| AC-6, AC-7 | update/deleteのID+Book条件、返却ID検証、patch非所有 |
| AC-8 | FrequentPaymentSuggestionsへPageのBook IDを渡し既存integrationを維持 |
| AC-9〜AC-11 | query key unit test |
| AC-12 | Book prefix invalidationと既存Summary invalidationのhook tests |
| AC-13 | Book・Payment domain docs更新 |
| AC-14 | Page/component既存testsとbrowser story |
| AC-15 | git diff scope確認、Web verification、DB/API/Auth/dependency差分なし |

## 10. Verification

Build / Verifyでは、repository rootから次を実行する。

1. `pnpm run web:format`
2. 同一batchで並列実行:
   - `pnpm run web:lint`
   - `pnpm run web:format-check`
   - `pnpm run web:typecheck`
   - `pnpm run web:test:unit-integration`
   - `pnpm run web:test:storybook`

Storybook testは`PaymentPage.stories.tsx`が`browser-test`対象であり変更するため必須とする。

## 11. リスクと確認事項

- selected Book error時はPayment操作を安全に止める代わりにPage contentを表示しない。新しい復帰操作はRequirementsにないため追加しない。
- component propsの伝播範囲が広いため、型エラーと既存Story/testでcall site漏れを検出する。
- MSWの既存`currentBookId` filteringはRLSを模しておりBook条件漏れを隠し得る。integration testではrequest URLの`book_id`を直接検証し、別Bookレスポンス検証も独立して置く。
- update/deleteの`.select("id").maybeSingle()`は返却表現を要求するが、schema/RLS/API定義は変更しない。対象なしをUI成功にしないための既存client API利用である。
- Summary queryは対象外でありselected Book IDを伝播しない。現在default Bookのみの体験では結果を変えず、将来の全体切り替えは別Requirementsで扱う。
