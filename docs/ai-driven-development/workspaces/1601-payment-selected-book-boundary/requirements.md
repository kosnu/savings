---
title: "Requirements: 支払い操作を選択中Bookの境界へ統一する"
doc_type: requirements
status: accepted
area: web
applies_to:
  - apps/web/src/features/books
  - apps/web/src/features/payments
  - docs/harness/domain/book.md
  - docs/harness/domain/payment.md
topics:
  - ai-driven-development
  - requirements
  - book
  - payment
  - authorization
  - query-cache
when_to_read:
  - Issue #1601の要求を設計、実装、検証するとき
  - 支払い操作の選択中Book境界とmembership認可の責務差を確認するとき
---

# Requirements: 支払い操作を選択中Bookの境界へ統一する

## 1. 文書の位置づけ

- Initial input: GitHub Issue #1601
- Cycle ID: `AIDD-1601-20260728-01`
- Artifact lineage: `docs/ai-driven-development/workspaces/1601-payment-selected-book-boundary/`
- Related issues: GitHub Issue #1209, GitHub Issue #1591

この文書は、Issue #1601と、ユーザーによる今回のAIDD cycle実行指示をRequirementsへ展開する。Issue内で未チェックだった実装・検証の自律範囲は、今回の明示的なcycle実行指示によって後続工程まで許可されたものとして扱う。

## 2. 背景

支払いを含むBook-owned dataは、Issue #1209でユーザー所有からBook所有へ移行した。現在のWeb UIにはBookを追加・選択・切り替える操作がなく、認証ユーザーのdefault Bookが唯一の操作対象である。

一方、DBとRLSは複数のBook membershipを許容する。現行Web実装では、支払い作成はDBによるdefault Book補完に依存し、一覧・詳細・更新・削除はmembership RLSが許可する全Bookを操作対象にし得る。よくある支払いだけはdefault Book IDを明示しているため、支払い機能内で操作境界が統一されていない。

## 3. 解決したい課題

- membershipによる認可と、ユーザーが現在操作しているBookの選択境界を分離する。
- 支払いの作成、一覧、詳細、更新、削除、よくある支払い候補を、同じ選択中Bookへ限定する。
- 支払いquery cacheをBookごとに分離し、将来Bookが切り替わっても別Bookの結果を再利用しない。
- 現在のdefault Bookだけを操作する体験を変えず、将来のBook選択UIを先行実装しない。

## 4. 対象ユーザーと利用シーン

### 対象ユーザー

- 認証済みで、現在のdefault Bookへ支払いを記録・確認・変更・削除するユーザー。

### 利用シーン

- 支払いを作成し、その支払いが現在のdefault Bookに保存される。
- 対象月の支払い一覧を見て、現在のdefault Bookの支払いだけを確認する。
- 一覧から支払い詳細を開き、同じBookに属する支払いだけを更新または削除する。
- 支払い作成フォームで、現在のdefault Bookの履歴だけから抽出された「よくある支払い」を選ぶ。
- 将来、選択中Bookの解決結果が変わった場合に、以前のBookの支払いcacheを表示しない。

## 5. ユーザーストーリー

- ユーザーとして、現在操作中のBookにだけ支払いを作成したい。そうすることで、意図しないBookへ支払いが保存されない。
- ユーザーとして、一覧と詳細で現在操作中のBookの支払いだけを見たい。そうすることで、別Bookの支払いが混在しない。
- ユーザーとして、現在操作中のBookに属する支払いだけを更新・削除したい。そうすることで、アクセス権があっても選択していないBookを誤操作しない。
- ユーザーとして、よくある支払いを現在操作中のBookの履歴だけから選びたい。
- ユーザーとして、現在のdefault Book運用では従来と同じ画面と操作を使い続けたい。

## 6. スコープ

### 対象

- Webアプリケーションで一意に解決される選択中Book。
- 現在のdefault Bookを選択中Bookとして扱う接続。
- 支払いの作成、一覧、詳細、更新、削除の選択中Book限定。
- Issue #1591のよくある支払い候補取得の選択中Book限定。
- 支払い一覧、詳細、候補のquery keyとmutation後のcache invalidation。
- membership認可と選択中Book操作境界に関するBook・Payment domain ruleの同期。
- 上記境界を確認するunit / integration test。

### 対象外

- Bookの追加、選択、切り替えUIまたは選択状態の永続化。
- Book共有、招待、メンバー管理、ロール。
- Category、Budget、月次集計機能全体の選択中Book対応。
- DB schema、RLS、認証方式、Supabase API契約の変更。
- Issue #1591の候補抽出条件、表示UI、選択時のフォーム挙動の変更。
- 新規依存の追加。

## 7. Rule Selection

### 作業分類

- path: `apps/web/src/features/books/**`, `apps/web/src/features/payments/**`, `docs/harness/domain/{book,payment}.md`
- domain: `book`, `payment`, `user`, `amount`, `date`, `category`, `web-cache`
- activity: `write_prd`, `change_payment_behavior`, `change_query`, `change_mutation`, `change_cache_invalidation`
- topic: `selected-book`, `authorization`, `payment`, `react-query`, `cache`

### Selected nodes

- `ai-driven.workflow` -> `docs/ai-driven-development/workflow.md`: Requirementsの責務と後続工程のread-only境界。
- `ai-driven.issue-guidelines` -> `docs/ai-driven-development/issue-guidelines.md`: Issueの意図とDesign判断の分離。
- `domain.book` -> `docs/harness/domain/book.md`: default Book、membership、Book ownershipの境界。
- `domain.payment` -> `docs/harness/domain/payment.md`: 支払いの所有先とCRUD規則。
- `web.query-cache` -> `apps/web/docs/policies/query-cache.md`: Book別cacheとmutation後再取得。
- `documentation.policy` -> `docs/harness/policies/documentation-policy.md`: Requirementsとdomain docsの責務、front matter。

### Depends-on nodes

- `ai-driven.overview`: Goalと成果物の分離。
- `domain.user`: 認証ユーザーとBook membershipの前提。
- `domain.amount`: 支払い金額の既存規則。
- `domain.date`: 支払い日と月範囲の既存規則。
- `domain.category`: 支払いとカテゴリが同じBookに属する規則。

### Conflict decision

- `domain.book`の暫定監督ルールに従い、現在はdefault Bookを唯一の選択中Bookとする。
- Issue #1601は既存の複数Book membershipを明示的に対象とするため、membershipが許可する全Bookと操作対象Bookを同一視しない。
- DBのdefault Book補完は互換性のため維持できるが、Webの支払い操作境界を暗黙補完だけへ依存させない。

## 8. Domain Value Intent

| 値 | 利用目的 | 要求 |
| --- | --- | --- |
| 選択中Book ID | 支払い操作の対象Bookを一意に識別する | 現在は認証ユーザーのdefault Book IDを使い、UIへ新しい値として表示しない。 |
| membership | ユーザーがBook-owned dataへアクセス可能か判定する | 認可にだけ使い、現在の操作対象を選ぶ情報として扱わない。 |
| Payment ID | 詳細・更新・削除対象を識別する | 選択中Book IDとの組み合わせで対象を限定する。 |
| PaymentのBook ID | 支払いの所有先を識別する | 選択中Bookと一致することを取得・操作境界で保証し、更新値にはしない。 |
| query key内のBook ID | cache結果の対象Bookを識別する | Bookが異なる一覧・詳細・候補を別cacheとして扱う。 |

## 9. 用語と責務境界

### 選択中Book

- アプリケーションが現在の操作対象として一意に解決したBookである。
- 現在は認証ユーザーのdefault Bookを選択中Bookとする。
- 選択中Bookを解決できるまで、支払いの取得やmutationを別の暗黙Bookへfallbackして実行しない。
- 今回はBookを切り替えるUIや状態を追加しない。

### membership認可

- membershipは、認証ユーザーが対象BookへアクセスできるかをDB/RLSで判定する境界である。
- membershipがあることだけでは、そのBookが現在の操作対象であることを意味しない。
- Webは選択中Bookで操作対象を限定し、RLSはその限定後も認可の防御境界として残る。

## 10. 機能要件

### FR-1: 選択中Bookを一意に解決する

- 認証ユーザーのdefault Bookを、支払い機能で共通利用できる選択中Bookとして解決する。
- 同じ認証セッション内の支払い操作は、同じ解決済みBook IDを境界に使う。
- 解決前または解決失敗時に、Book IDを省略した支払い取得・mutationを開始しない。
- 新しいBook選択UI、手動retry、画面遷移を追加しない。

### FR-2: 支払い作成を選択中Bookへ限定する

- 新しい支払いの所有先は、作成時点の選択中Bookである。
- 支払い作成で指定するカテゴリは、選択中Bookと同じBookに属する既存規則を維持する。
- DBの暗黙default補完だけを、Webの操作対象決定として扱わない。

### FR-3: 支払い一覧を選択中Bookへ限定する

- 日付範囲とカテゴリ条件に加えて、選択中Book IDを取得条件にする。
- membershipがある別Bookの支払いを一覧結果へ含めない。
- 返却された各支払いのBook IDが選択中Book IDと一致しない場合は、正常な一覧結果として扱わない。

### FR-4: 支払い詳細を選択中Bookへ限定する

- Payment IDと選択中Book IDの両方で詳細対象を限定する。
- membershipがあっても、別BookのPayment IDは現在の詳細として取得しない。
- 詳細レスポンスのBook IDが選択中Bookと一致しない場合は、正常な詳細結果として扱わない。

### FR-5: 支払い更新・削除を選択中Bookへ限定する

- Payment IDと選択中Book IDの両方で更新・削除対象を限定する。
- 選択中Bookに対象が存在しない場合、別Bookの支払いを変更せず、操作成功として扱わない。
- 更新payloadにBook IDを含めず、所有先Bookを変更しない。

### FR-6: よくある支払い候補を選択中Bookへ限定する

- Issue #1591で定義した候補取得は、同じ選択中Book IDを取得条件とcache境界に使う。
- 候補レスポンス内の支払いとカテゴリのBook IDが選択中Bookと一致することを維持する。
- 候補抽出条件、期間、件数、UI、フォーム反映は変更しない。

### FR-7: 支払いcacheをBookごとに分離する

- 支払い一覧、詳細、よくある支払い候補のquery keyは選択中Book IDを含む。
- 同じ日付・カテゴリ・Payment ID・候補期間でも、Book IDが異なれば別query keyになる。
- 支払いmutation後は、操作対象Bookの支払いcacheを再取得可能な状態にする。
- cacheの直接書き換えやoptimistic updateを追加せず、source of truthの再取得を使う。

### FR-8: domain ruleを同期する

- Book domain ruleに、membershipが認可境界、選択中Bookが操作対象境界であることを記録する。
- Payment domain ruleに、Webの支払いCRUDと候補が選択中Bookへ限定されることを記録する。
- 現在はdefault Bookが唯一の選択中Bookである暫定状態と、将来のBook選択機能を区別する。

## 11. 非機能要件と制約

- 現在のdefault Bookだけを使うユーザーの表示、入力項目、操作手順を変えない。
- DB schema、RLS、認証方式、Supabase API契約を変更しない。
- Book選択機能、Category/Budget全体のBook対応、新規依存を先行実装しない。
- PaymentのBook IDを更新可能なフォーム値またはpatch値にしない。
- 選択中Bookの境界は型とテストから追跡可能にする。
- client-side cacheをBook選択状態や業務状態のsource of truthにしない。

## 12. 受け入れ条件

- AC-1: default Book IDが42なら、支払い機能の選択中Bookは42として一意に解決される。
- AC-2: 選択中Bookが未解決または取得失敗の間は、Book IDを省略した支払いquery / mutationが実行されない。
- AC-3: 選択中Book IDが42の支払い作成はBook 42を所有先とし、DBの暗黙補完だけへ依存しない。
- AC-4: 選択中Book IDが42の一覧取得はBook 42で限定され、membershipがあるBook 43の支払いを返さない。
- AC-5: Payment IDが同じ取得操作でも、Book 42の詳細条件からBook 43の支払いを取得しない。
- AC-6: Book 42を選択中にBook 43のPayment IDを更新・削除しても対象は変更されず、成功として扱われない。
- AC-7: 支払い更新payloadにBook IDが含まれず、既存の所有先Bookが維持される。
- AC-8: よくある支払い候補は選択中Bookだけを取得・検証し、Issue #1591の抽出・表示・選択挙動は変わらない。
- AC-9: 一覧条件が同じでもBook 42とBook 43のquery keyは異なる。
- AC-10: 同じPayment IDでもBook 42とBook 43の詳細query keyは異なる。
- AC-11: 同じ期間でもBook 42とBook 43の候補query keyは異なる。
- AC-12: 支払いmutation成功後は、対象Bookの一覧・詳細・候補cacheを再取得できる。
- AC-13: Book・Payment domain ruleにmembership認可と選択中Book操作境界の責務差が記録される。
- AC-14: default Bookだけを利用する既存ユーザーの画面、入力項目、操作手順は変わらない。
- AC-15: Book UI、Category/Budget全体、DB schema、RLS、認証方式、API契約、新規依存に差分がない。

## 13. Q&Aログ

- Q: 現在の選択中Bookは何か？
  - A: Book選択UIがない現在は、認証ユーザーのdefault Bookである。
- Q: membershipがあるBookをすべて操作対象にするか？
  - A: しない。membershipは認可、選択中Bookは操作対象であり、責務を分離する。
- Q: DBのdefault Book補完を削除するか？
  - A: 削除しない。DB変更は対象外であり、Webが操作対象を暗黙補完だけへ依存しないことを要求する。
- Q: 支払い詳細・更新・削除はPayment IDだけで十分か？
  - A: 不十分。現在の操作境界を保証するため、選択中Book IDとの組み合わせで対象を限定する。
- Q: Book切り替えUIや選択状態を今回作るか？
  - A: 作らない。将来の選択元を差し替えられる境界だけを定義し、現在はdefault Bookへ接続する。
- Q: Issue内の実装・検証チェックが未選択でも後続工程へ進むか？
  - A: 進む。ユーザーがこのbranchでAIDD cycle全体を明示実行したため、その指示を今回cycleの自律許可として扱う。

## 14. 技術的考慮事項

- 現行の`fetchCurrentBook` / `useCurrentBook`はdefault membershipからBookを一意に取得しており、Design / Planでは設定画面固有の配置からアプリケーション境界へどう接続するかを検討する。
- 現行一覧・詳細・更新・削除はPayment ID、日付、カテゴリだけでDB queryを限定し、Book IDを条件にしていない。
- 現行作成はBook IDを送らずDB default補完へ依存している。
- 現行のよくある支払いはBook IDをquery条件・レスポンス検証・query keyに含めており、共通境界へ接続する既存例になる。
- 現行一覧query keyは任意の`cacheScope`、日付、カテゴリ、詳細query keyはPayment IDだけであり、Book IDを識別できない。
- mutation後のinvalidationは支払い全体と月次集計を対象にする。Design / Planでは既存の月次集計無効化を維持しつつ、Payment cacheのBook境界を明確にする。
- 更新・削除で対象なしを成功にしないためのレスポンス確認方法は、既存Supabase client APIの範囲でDesign / Planにて決定する。
