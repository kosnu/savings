---
title: Transaction Boundaries
doc_type: policy
status: accepted
area: repository
applies_to:
  - apps/web
  - apps/api
topics:
  - transaction
  - consistency
  - rpc
  - api
  - database
when_to_read:
  - 複数のデータ作成・更新・削除を1つのユーザー操作で扱うとき
  - 片方だけ成功する状態を避ける必要があるとき
  - RPC、API、DB transaction、アプリケーション層の責務境界を決めるとき
---

# Transaction Boundaries

1つのユーザー操作が複数のデータ作成・更新・削除を含む場合は、片方だけ成功した状態がユーザー体験やデータ整合性を壊さないかを確認します。

片成功を避ける必要がある場合は、Design / Planで同一操作単位を明示します。実装手段は既存構成と制約に合わせて選びます。

## 判断基準

次のいずれかに当てはまる場合は、同一操作単位として扱うことを検討します。

- 片方だけ成功すると、ユーザーに成功状態を誤認させる
- 片方だけ成功すると、後続画面や集計結果が要件と矛盾する
- ユーザーが1つの保存・作成・削除操作として認識する
- 失敗時に個別復旧よりも全体失敗として扱う方が自然
- 片成功の検知や補償処理が複雑になる

## Design / Planで決めること

- どのデータ変更を同一操作単位に含めるか
- どの層で境界を作るか
- 片成功が起きた場合のユーザー影響
- 採用しない案と理由
- 残る競合リスクやスコープ外の補償

## 実装境界の候補

- DB transaction / database function
- RPC / API endpoint
- アプリケーション層の明示的な更新順序と失敗処理
- 補償処理または再試行

DB constraint、trigger、RPC、API追加などが既存の制約やスコープを超える場合は、Build / Verifyで勝手に追加せずStop条件として扱います。
