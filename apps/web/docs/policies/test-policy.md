---
title: Web Test Policy
doc_type: policy
status: accepted
area: web
applies_to:
  - apps/web/src
topics:
  - test
  - regression
  - storybook
when_to_read:
  - Webアプリのテストを追加または変更するとき
  - コンポーネントのStoryをテストで再利用するか判断するとき
  - review 対応でテストを追加するか判断するとき
---

# Web Test Policy

テストは、ユーザーに残る挙動の回帰を防ぐために追加します。

## 基本方針

- ユーザーが独立して利用できる表示責務は、それぞれの loading、error、正常表示、条件変更後の復帰を、他の表示責務の状態から独立した永続的な挙動としてテストします。
- Suspense または ErrorBoundary を追加・変更する場合は、その境界に定義した月、検索条件、ID などの復帰条件について、取得失敗後に条件を変更し、API 境界を通って正常表示へ復帰することをテストします。
- 実装順序、コンポーネント内部の一時的な並び、review 対応の途中状態だけを固定するテストは追加しません。
- 一時的な確認だけが目的のテストは、実装完了後に残しません。
- API 通信を伴うテストでは、実際のコンポーネント操作と API 境界を通して確認します。
- 既存の入力、検証、テスト境界を新しい利用箇所へ広げる変更では、既存テストが通ることだけで十分と判断しません。実装前に入力値、URL、API応答、状態遷移の境界を監査し、境界値、不正値、未解決状態、既存経路との整合について不足する回帰テストと検証を追加します。
- 非同期に増減する要素の件数は、処理途中の状態を即時に固定せず、期待する安定状態まで待ってから検証します。
- コンポーネントのテストは、原則として同じコンポーネントの Story を `composeStories` で再利用して書きます。同じ args、provider、初期状態をテスト側へ重複定義しません。
- Story を使わず対象コンポーネントを直接利用してテストを書く場合は、Story の責務を歪めないと表現できない API の順序や一時的な内部条件など、Story を再利用できない理由をテストコード内のコメントに残します。テスト専用の内部条件を Story に持ち込みません。
- 保存操作の成功表示が source of truth の再取得結果に依存する場合は、送信中の主操作が loading / disabled になることと、mutation 成功後の再取得失敗を成功扱いしないことを回帰テストで確認します。
- mutation の成功条件が API 応答の対象IDまたは件数に依存する場合は、対象なしと、別対象または期待件数との不一致を区別して回帰テストで確認します。
- テスト helper は、期待値の有無で検証を省略しません。任意項目も「存在しないこと」を期待値として扱い、`expect` で常に検証します。
- テストの成立に必須の browser API や要素は、optional chaining によって `undefined` を期待式へ渡しません。存在を明示的に確定してから非 optional の値として検証し、不在の場合はその前提で直接失敗させます。

## 関連ポリシー

- `apps/web/docs/policies/component-structure.md`
- `apps/web/docs/policies/msw-handlers.md`
- `apps/web/docs/policies/storybook-browser-tests.md`
- `apps/web/docs/policies/suspense-boundaries.md`
