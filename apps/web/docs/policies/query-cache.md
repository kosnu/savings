---
title: Query Cache Policy
doc_type: policy
status: accepted
area: web
applies_to:
  - apps/web/src
topics:
  - react-query
  - cache
  - frontend-architecture
when_to_read:
  - WebアプリでReact Queryのqueryやmutationを追加または変更するとき
  - query invalidation、refetch、cache更新の扱いを判断するとき
  - API更新後に画面上の古いデータをどう反映するか迷うとき
  - cache値と再取得した最新値を副作用へ同期するとき
---

# Query Cache Policy

Webアプリの client-side cache は、サーバーやDBの source of truth を補助するための一時的な読み取り結果として扱います。

React Query cache などの client-side cache を、業務状態そのものの保存先として扱ってはいけません。

## 基本方針

- 原則として `setQueryData` などで query cache を直接変更しません。
- mutation 後の反映は、refetch、invalidation、query option の見直し、または source of truth 側の更新で行います。
- mutationの成功はwrite契約で判断します。write契約が対象の更新成功を確認している場合、後続のrefetch失敗をmutation失敗やユーザー向けの未確認状態へ読み替えません。
- mutation後のrefetchが内部的なcache収束を目的とする場合、cacheを所有する境界がinvalidation、内部retry、または次回取得による収束を担います。refetch失敗を握り潰して古いcacheを正本として固定してはいけません。
- write契約だけでは保存結果そのものを確認できない場合、または再取得失敗によってユーザー向け結果を正しく保てない場合は、再取得をユーザー操作の完了条件として扱い、失敗を呼び出し元へ伝播させます。
- staleTime や refetchOnMount などの設定によって古いデータが残る場合も、まず query の取得・無効化・再取得の責務を見直します。
- cache の内容にだけ存在する状態を作らないようにします。

## Cache値から最新値への更新

queryは、同じquery keyでもcacheにある値を先に返し、その後の再取得でsource of truthの最新値を返すことがあります。query結果を別の状態や外部システムへ反映する副作用は、この更新を受け取れるようにします。

- entity IDやquery keyだけを一度適用済みとして記録し、同じ対象の後続データを無条件に無視してはいけません。
- 重複適用を防ぐ必要がある場合は、適用した値またはデータの世代を判定に含め、より新しいsource of truthの値を適用できるようにします。
- cache値の適用を、同じquery keyに対する最新値の適用完了とみなしてはいけません。

## 例外

直接 cache 更新が必要に見える場合は、実装前に止まって確認します。

例外として扱うには、少なくとも以下を明確にします。

- refetch や invalidation では要件を満たせない理由
- source of truth と cache の不整合が起きない根拠
- 失敗時、再取得時、別画面からの更新時の挙動
- その例外を閉じ込める範囲

確認なしに optimistic update や手動の cache 差し替えを追加してはいけません。
