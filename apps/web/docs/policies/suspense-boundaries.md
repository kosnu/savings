---
title: Suspense Boundary Policy
doc_type: policy
status: accepted
area: web
applies_to:
  - apps/web/src
topics:
  - suspense
  - react-query
  - error-boundary
when_to_read:
  - WebアプリでSuspense、ErrorBoundary、React Queryのqueryを使う表示を追加または変更するとき
  - Suspense fallback、error fallback、条件変更後の復帰を扱うとき
---

# Suspense Boundary Policy

Suspense を使う API 読み込みは、近い実装の形に合わせて、表示状態と復帰条件を明確にします。

## 基本方針

- Suspense を使う API 読み込みを追加または変更する場合は、原則として `useSuspenseQuery` と `Suspense` の形に揃えます。
- query hook は resolved data を返し、`useSuspenseQuery` を呼ぶ resolved component を対応する `Suspense` と `ErrorBoundary` の内側に置きます。
- `useQuery`、local loading state、手動 fetch へ切り替える場合は、変更前に理由を明確にします。
- ErrorBoundary の fallback から復帰する必要がある表示では、query key の変更だけで復帰すると仮定しません。
- 月、検索条件、ID などの表示対象が変わることで再表示すべき場合は、同じ状態を `resetKeys` に含めます。
- ErrorBoundary の復帰判定に必要な key は、境界を所有する component が query key と同じ入力から組み立てます。
- query key input に default 適用や変換が必要な場合は、query hook と境界が同じ canonical な正規化済み値を受け取る形にします。query hook と境界で同じ正規化処理を別々に実装したり、raw props と正規化後の値を混在させたりしません。
- query result の `promise` と `React.use(promise)` をデータ取得の読み取り経路にしません。

## 境界変更時の確認

Suspense または ErrorBoundary を追加・変更する場合は、境界ごとに次を確認します。

- 境界内の query key input と、その canonical な正規化済み値
- fallback から復帰させる月、検索条件、ID などの条件
- loading、error、正常表示を所有する表示責務
- query key input と `resetKeys` が同じ canonical な正規化済み値から組み立てられていること

条件変更による fallback からの復帰は、`apps/web/docs/policies/test-policy.md` に従って回帰テストで確認します。

## 複数 query の開始順序

- 相互にデータ依存しない query は、先に suspend する query の resolved component 配下へ移して不要な waterfall を作らず、並行して開始します。
- 後続 query の入力が先行 query の結果に依存する場合だけ直列化し、その依存関係を呼び出し構造から確認できる形にします。
- 同じ loading、error、復帰責務を持つ複数 query は、共通の resolved component で `useSuspenseQueries` を使って開始します。
- loading、error、復帰責務が異なる複数 query は、境界を統合せず、prefetch などによって独立した境界を維持したまま並行して開始します。

## 関連ポリシー

- `apps/web/docs/policies/query-cache.md`
- `apps/web/docs/policies/test-policy.md`
