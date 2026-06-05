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
  - WebアプリでSuspense、ErrorBoundary、React Queryのpromiseを使う表示を追加または変更するとき
  - Suspense fallback、error fallback、条件変更後の復帰を扱うとき
---

# Suspense Boundary Policy

Suspense を使う API 読み込みは、近い実装の形に合わせて、表示状態と復帰条件を明確にします。

## 基本方針

- Suspense を使う API 読み込みを追加または変更する場合は、原則として `useQuery`、`query.promise`、`Suspense`、`use(promise)` の形に揃えます。
- 異なる query API、local loading state、手動 fetch へ切り替える場合は、変更前に理由を明確にします。
- ErrorBoundary の fallback から復帰する必要がある表示では、query key の変更だけで復帰すると仮定しません。
- 月、検索条件、ID などの表示対象が変わることで再表示すべき場合は、同じ状態を `resetKeys` に含めます。
- hook は promise と復帰判定に必要な key を返し、resolved component は `use(promise)` で値を読む形を優先します。
- data と promise の両方を渡して同じ値の読み取り経路を二重化しません。

## 関連ポリシー

- `apps/web/docs/policies/query-cache.md`
- `apps/web/docs/policies/test-policy.md`
