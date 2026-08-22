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
  - async-readiness
  - session-lifecycle
when_to_read:
  - WebアプリでSuspense、ErrorBoundary、React Queryのpromiseを使う表示を追加または変更するとき
  - Suspense fallback、error fallback、条件変更後の復帰を扱うとき
  - providerまたはlocal stateで子画面の描画を待機させる非同期境界を追加または変更するとき
  - 認証セッション更新など、同じ表示対象のcontext更新後の復帰を扱うとき
---

# Suspense Boundary Policy

Suspense または provider や local state で表示を待機させる API 読み込みは、近い実装の形に合わせて、表示状態と復帰条件を明確にします。

## 基本方針

- Suspense を使う API 読み込みを追加または変更する場合は、原則として `useQuery`、`query.promise`、`Suspense`、`use(promise)` の形に揃えます。
- 異なる query API、local loading state、手動 fetch へ切り替える場合は、変更前に理由を明確にします。
- ErrorBoundary の fallback から復帰する必要がある表示では、query key の変更だけで復帰すると仮定しません。
- 月、検索条件、ID などの表示対象が変わることで再表示すべき場合は、同じ状態を `resetKeys` に含めます。
- hook は promise と復帰判定に必要な key を返し、resolved component は `use(promise)` で値を読む形を優先します。
- data と promise の両方を渡して同じ値の読み取り経路を二重化しません。

## 非同期描画準備の同一性と復帰

Suspense を使わず、provider や local state で子画面の描画を待機させる場合も、表示対象と復帰条件を明示します。

- 準備完了の判定は、表示対象を表す安定した意味上の識別子と、表示に必要なデータの世代に基づけます。一時的なオブジェクトの参照同一性だけを準備状態の識別子にしてはいけません。
- 認証セッションの更新などでcontextが更新されても、意味上の表示対象が同じで、表示に必要なデータが引き続き有効なら、準備完了を維持します。
- 継続中の認証セッションの更新と、サインアウトを挟んで開始された新しい認証セッションを区別します。同じユーザーの再ログインも新しいデータ世代として扱います。
- 別端末またはサインアウト中に変更され得るsource of truthの値が描画準備に必要な場合、新しい認証セッションではclient-side cacheのfreshnessに関係なく再取得します。cache値だけを準備完了の根拠にせず、最新値の取得またはfallback決定後に表示へ復帰させます。
- 表示対象または必要なデータの世代が変わった場合は準備状態を再評価し、最新データの解決またはfallback決定後に表示へ復帰させます。
- 非同期処理が進行しておらず、retryまたは再評価の経路もないまま、子画面を非表示にし続ける状態を作ってはいけません。
- 回帰テストでは、継続中の認証セッションの更新と、同じユーザーを含む新しい認証セッションを区別し、ユーザー向け表示が適切に維持または再解決されることを確認します。再ログイン時の再取得を検証する場合は、事前の明示的なcache invalidationを前提にしません。

## 関連ポリシー

- `apps/web/docs/policies/query-cache.md`
- `apps/web/docs/policies/test-policy.md`
