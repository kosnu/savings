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
- 実装順序、コンポーネント内部の一時的な並び、review 対応の途中状態だけを固定するテストは追加しません。
- 一時的な確認だけが目的のテストは、実装完了後に残しません。
- API 通信を伴うテストでは、実際のコンポーネント操作と API 境界を通して確認します。
- コンポーネントのテストは、原則として同じコンポーネントの Story を `composeStories` で再利用して書きます。同じ args、provider、初期状態をテスト側へ重複定義しません。
- Story を使わず対象コンポーネントを直接利用してテストを書く場合は、Story の責務を歪めないと表現できない API の順序や一時的な内部条件など、Story を再利用できない理由をテストコード内のコメントに残します。テスト専用の内部条件を Story に持ち込みません。
- 保存操作の成功表示が source of truth の再取得結果に依存する場合は、送信中の主操作が loading / disabled になることと、mutation 成功後の再取得失敗を成功扱いしないことを回帰テストで確認します。
- テスト helper は、期待値の有無で検証を省略しません。任意項目も「存在しないこと」を期待値として扱い、`expect` で常に検証します。

## 関連ポリシー

- `apps/web/docs/policies/component-structure.md`
- `apps/web/docs/policies/msw-handlers.md`
- `apps/web/docs/policies/storybook-browser-tests.md`
- `apps/web/docs/policies/suspense-boundaries.md`
