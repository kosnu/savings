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
---

# Query Cache Policy

Webアプリの client-side cache は、サーバーやDBの source of truth を補助するための一時的な読み取り結果として扱います。

React Query cache などの client-side cache を、業務状態そのものの保存先として扱ってはいけません。

## 基本方針

- 原則として `setQueryData` などで query cache を直接変更しません。
- mutation 後の反映は、refetch、invalidation、query option の見直し、または source of truth 側の更新で行います。
- mutation の成功通知や完了状態は、source of truth の再取得が成功するまで確定させません。invalidation の完了だけを再取得成功とみなさず、再取得に失敗した場合は成功として扱わずエラー状態へ遷移させます。
- staleTime や refetchOnMount などの設定によって古いデータが残る場合も、まず query の取得・無効化・再取得の責務を見直します。
- cache の内容にだけ存在する状態を作らないようにします。

## 例外

直接 cache 更新が必要に見える場合は、実装前に止まって確認します。

例外として扱うには、少なくとも以下を明確にします。

- refetch や invalidation では要件を満たせない理由
- source of truth と cache の不整合が起きない根拠
- 失敗時、再取得時、別画面からの更新時の挙動
- その例外を閉じ込める範囲

確認なしに optimistic update や手動の cache 差し替えを追加してはいけません。
