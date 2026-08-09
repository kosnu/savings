---
title: Code Review Policy
doc_type: policy
status: accepted
area: repository
applies_to:
  - apps/web
  - apps/api
  - AGENTS.md
  - .github/skills/code-review
topics:
  - review
  - rule-graph
  - pull-request
  - verification
when_to_read:
  - 実装済みの差分をレビューするとき
  - 複数のルール、ポリシー、設計判断が同じ差分に適用されるとき
  - Copilot code reviewの確認範囲を決めるとき
---

# Code Review Policy

この文書は、レビュー時にどの正本文書を適用するかを定義します。個別の設計判断、ポリシー、ドメインルールの本文は各正本文書に置き、この文書へ複製しません。

## レビュー対象

- レビュー対象は実装済みの差分、変更ファイル、変更された呼び出し経路です。
- PR本文、PRタイトル、既存コメントに書かれた意図は、ルール適用や問題判定の根拠にしません。
- 作業ツリーの無関係な変更や、差分に含まれない既存コードは対象にしません。

## 適用範囲

1つの差分には複数の変更面が同時に含まれます。変更面を1つに絞ったり、priorityの高いルールだけを残したりせず、該当する正本ノードをすべて和集合します。

選択したノードの `depends_on` は必ず読みます。`related` は通常のrule-map上では任意参照ですが、下表でレビュー必須として示したノードは必ず読みます。

指摘を1件見つけてもレビューを終了せず、適用された全ノードの確認を完了します。ルール間に解消できない矛盾がある場合は、推測で判定せず矛盾と確認事項を報告します。

## Webのレビュー必須ルーティング

| 変更面 | 変更の兆候 | レビューで必ず確認するrule ID |
| --- | --- | --- |
| コンポーネント | `apps/web/src/components/**` または `apps/web/src/features/**` のコンポーネント追加、移動、抽出、責務分離 | `web.component-structure` |
| Feature配置 | `apps/web/src/features/**` の新規配置、移動、feature境界変更 | `web.feature-directory` |
| UI | WebのJSX/TSX、style、layout、form、dialog、responsive、variant、size、colorの変更 | `web.design-system-brand`, `web.design-rules` |
| ドメインUI | featureまたはrouteで金額、日付、月、分類、状態、基準値を表示・入力・更新 | `web.domain-ui-rules` と該当する `domain.*` |
| Query / mutation / cache | `useQuery`、`useMutation`、query key、invalidation、refetch、`QueryClient`、API更新後の反映の変更 | `web.query-cache` |
| 非同期状態 | loading、error、retry、Error Boundary、非同期取得境界の変更 | `web.suspense-boundaries` |
| Story | `*.stories.tsx` の追加・変更、またはStory作成条件に該当するコンポーネント追加 | `web.component-structure`, `web.storybook-browser-tests` |
| 回帰テスト | ユーザーに残る表示、入力、保存、取得、状態遷移の追加・変更 | `web.test-policy` |

ドメイン値が金額または日付に該当する場合は、`domain.amount` または `domain.date` と、それらを依存関係から追加する選択ノードを確認します。Storyはbrowser testの実行対象であることを意味しません。`web.storybook-browser-tests` を読み、収集範囲、tag、provider、MSWの要否を判定します。

## APIのレビュー必須ルーティング

APIの正本は、Supabase/Auth/Databaseの構成を扱う `docs/infrastructure.md`、実行境界を扱う `docs/harness/policies/transaction-boundaries.md`、期間と履歴を扱う `docs/harness/policies/temporal-data.md`、および対象domainの文書です。`apps/api/README.md` は操作手順とディレクトリ構成の案内として使い、ルール本文の代わりにはしません。

| 変更面 | 変更の兆候 | rule-map activity | レビューで必ず確認するrule ID |
| --- | --- | --- | --- |
| DB schema / migration | `apps/api/supabase/migrations/**` のtable、column、constraint、index、triggerの追加・変更 | `review_api_schema` | `infrastructure.overview`, `policy.transaction-boundaries`、該当する `domain.*` |
| RPC / database function | `CREATE FUNCTION`、RPC、DB function、複数更新をまとめる処理の追加・変更 | `review_api_rpc` | `infrastructure.overview`, `policy.transaction-boundaries`、該当する `domain.*` |
| RLS / Auth / ownership | RLS policy、Auth設定、認証済みユーザー確認、`user_id`やownership境界の追加・変更 | `review_api_auth` | `infrastructure.overview`, `policy.transaction-boundaries`, `domain.user` |
| 期間・履歴・月次状態 | `current_date`、`now()`、有効期間、履歴、月次状態、削除・無効化の扱いの追加・変更 | `review_api_temporal` | `infrastructure.overview`, `policy.temporal-data`, `domain.date`、該当する `domain.*` |
| API domain | 金額、日付、支払い、カテゴリ、予算、Book、ユーザーのschema・RPC・seedの追加・変更 | 対象domainの `review_*` | 該当する `domain.amount`、`domain.date`、`domain.payment`、`domain.category`、`domain.monthly-budget`、`domain.book`、`domain.user` |
| API config / seed | `apps/api/supabase/config.toml` または `apps/api/supabase/seed/**` の追加・変更 | `review_infrastructure` | `infrastructure.overview` と該当する `domain.*` |

期間・履歴・月次状態に該当するDB変更では、通常のschema、RPC、Authの確認に加えて `policy.temporal-data` を必ず確認します。RLSやAuthに該当する差分では、認証・ownershipの境界とtransactionの責務を分けて確認します。

Web/APIの表に該当しない差分は、`docs/harness/rule-map.json` の有効な `applies_to.paths`、`domains`、`activities`、`topics` に一致するノードをすべて選び、同じ和集合ルールを適用します。`apps/api/**` の差分で変更面を分類できない場合は、汎用マッチングだけで完了扱いにせず、未定義のAPIレビュー面として報告します。

## レビュー結果

レビュー結果には、PR概要ではなくレビュー結果のサマリとして、次を記録します。

```text
## Coverage
- Checked rules: <確認したrule ID>
- Unresolved: <未解決の矛盾またはなし>
```

その後に、重要度順で各findingの重要度、ファイルと行番号、問題、影響、根拠、修正案を報告します。findingがない場合も、確認した範囲と残っている検証不足を記録します。

この記録はレビューの適用範囲を確認するための証跡であり、PR本文や正本文書の代わりにはしません。

## レビュー担当の扱い

この方針は、複数のレビュー担当者を割り当てたり、独自のリスク分類で確認範囲を削減したりしません。確認範囲は差分とこの文書、`rule-map.json`、選択された正本文書で決まります。
