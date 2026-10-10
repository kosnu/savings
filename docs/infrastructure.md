---
title: インフラ構成
doc_type: overview
status: accepted
area: infrastructure
applies_to:
  - apps/web
  - apps/api
topics:
  - cloudflare
  - supabase
  - hosting
  - database
  - branding
  - oauth
  - deployment
when_to_read:
  - ホスティングまたはDNS構成を確認するとき
  - Supabase AuthまたはPostgreSQLの利用前提を確認するとき
---

# インフラ構成

本プロジェクトの Web アプリケーションは、以下のクラウドサービスを利用して構築・運用されています。

## 利用サービス一覧

- **Cloudflare Workers Static Assets**
  - Web アプリケーション（React SPA）のホスティングに利用。
  - HTTPS 対応、CDN による高速配信。
  - リポジトリの移管後設定。本番切替は[移管手順](workers-migration.md)の承認・確認後に実施。
- **Cloudflare Domain**
  - 独自ドメインの管理に利用。
  - DNS 設定や SSL 証明書の管理も Cloudflare で実施。
- **Supabase Auth**
  - Web アプリの Google ログインに利用。他 provider の実際の有効状態は別途確認する。
  - セキュアな認証基盤を提供。
- **Supabase PostgreSQL**
  - リレーショナルデータベースとして利用。
  - ユーザーデータやアプリケーションデータを保存。

## 構成図

```
[User]
  │
  ▼
[Cloudflare Domain] ──> [Workers Static Assets] ──> [Web App (React SPA)]
                                                    │
                                                    ▼
                                              [Supabase]
                                                ├─> [Auth]
                                                └─> [PostgreSQL]
```

## 外部サービスのブランド構成

### Google OAuth

- Google Cloud project と OAuth 同意画面のアプリ名は `Burneto` とする。
- OAuth 同意画面のロゴには、[#1774](https://github.com/kosnu/savings/issues/1774) で作成した正方形の
  [ブランドアイコン](../apps/web/public/brand/icon-master.png)を使用する。
- Web application の OAuth client は Supabase 用として管理し、次の URI を登録する。
  - Authorized JavaScript origins: `http://localhost:5173`、`https://burneto.com`
  - Authorized redirect URIs: `http://localhost:54321/auth/v1/callback`、
    `https://izuzqvgvgquqqimwuygw.supabase.co/auth/v1/callback`
- OAuth client ID と client secret は Supabase および GitHub Environment のsecretで管理し、
  リポジトリへ保存しない。

### Cloudflare Workers Static Assets

- Worker 名は `burneto`、本番 custom domain は `burneto.com` とする。
- [cloudflare.config.ts](../apps/web/cloudflare.config.ts) が配信先と SPA fallback を所有する。
  静的ファイルのみを配信し、Worker のサーバーコードを追加しない。
- Cloudflare Vite plugin が既存の Web ビルドから `.cloudflare/output/v0/` を作成する。
  [deploy_production.yaml](../.github/workflows/deploy_production.yaml) は cf を使い、
  `--prebuilt --mode production` で同じ成果物を検証・配信する。
- 旧 Pages project `burneto`、既存 deployment、`savings-dyo.pages.dev` は切り戻し用に保持する。
  本番切替後も旧 hostname は旧 Pages を配信し、Workers への転送先にはしない。
- 本番切替と旧 Pages 削除は別の承認対象とする。準備・切替・確認・切り戻しは
  [移管手順](workers-migration.md)を参照する。

### Supabase

- Dashboard上のproject表示名は `Burneto` とする。
- Project IDと `*.supabase.co` URLはAPI・認証callbackの識別子なので変更しない。
  Free planではcustom domainを追加せず、Google OAuth中に表示されるSupabase URLは
  認証基盤のURLとして維持する。
- Google providerは有効のまま維持し、Google Auth PlatformのSupabase用OAuth clientを使用する。
- Site URLは `https://burneto.com/`、redirect allow listは
  `https://burneto.com/auth` とする。

### Authentication redirect

Googleログインのredirectは次の順序を維持する。

1. Web Appが現在のoriginの `/auth` を `redirectTo` に指定する。
2. Google OAuthがSupabaseの `/auth/v1/callback` へ戻す。
3. Supabaseがallow list内の `/auth` へ戻す。
4. Web Appが認証済みsessionを確認して `/` のトップページへ遷移する。

変更後は、既存sessionで `/auth` から `/` へ遷移することに加え、Googleログインを開始して
同意画面にBurnetoの名称とロゴが表示され、callback後に `/` のトップページへ到達することを確認する。

### Supabase の公開準備

[#1885](https://github.com/kosnu/savings/issues/1885) は未完了。本番・共有 Dev の設定変更、migration 適用、配信は、
対象・影響・切り戻しへの承認後に行う。以下は 2026-10-06 の読み取り確認と、未適用の準備である。
`apps/api/supabase/config.toml` の Auth 環境変数や不要サービスの無効化はローカル設定であり、
Hosted project の実設定を証明しない。

| 確認面         | Prd / Dev の観測                                                                                                                             | 判断・残る確認                                                                                                                                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB・履歴       | PostgreSQL 17、既存36 migration の version/name と repo が一致。Prd は 17.6、Dev は 17.11                                                    | SQL 本文の一致は履歴一覧だけでは証明できない。新 migration は両環境に未適用                                                                                                                                                |
| RLS            | public の8テーブルすべて有効、Book 所属・本人を確認する policy、users UPDATE は USING / WITH CHECK が一致                                    | metadata と隔離DB試験を区別する。Hosted Data API の実機試験は未実施                                                                                                                                                        |
| テーブル権限   | anon / authenticated は8テーブルで TRUNCATE が可能。postgres / supabase_admin の public default privileges も将来表へ付与                    | RLS は TRUNCATE を保護しない。通常 CRUD を維持して不要権限を取り消す準備。現在の REST から攻撃可能とは断定しない                                                                                                           |
| DB接続         | 両環境で ssl=on、max_connections=60。API role の statement_timeout は anon=3s、authenticated / authenticator=8s。調査接続の pg_settings は5s | role設定はAPI実リクエストの実効timeoutを証明しない。anon / authenticated / authenticator に superuser・BYPASSRLS なし。ssl=on は SSL 強制を証明しない。SSL Enforcement、Network Restrictions、pooler、管理者・MFA は未確認 |
| Data API・キー | public view なし。repo の Web client は publishable key だけを参照                                                                           | authenticated の users UPDATE は name / language のみ。exposed schemas、他の列権限、max_rows、auto exposure、配信時のキー種別・管理 token の scope は未確認。秘密値は記録しない                                            |
| サービス       | Edge Function なし、pg_graphql extension なし、Realtime publication は存在するが登録テーブルなし                                             | publication の存在だけでは不要サービスの利用状態は分からない。Storage・Realtime の実有効状態は未確認なので変更しない                                                                                                       |
| Auth           | repo は Google provider と既存 callback を維持。Advisor は両環境で漏洩 password 保護無効を報告                                               | provider、redirect allow list、nonce、JWT/session・refresh、rate limit、CAPTCHA の実値と Google 経路への適用範囲は未確認。メール用対策を Google 対策と同一視せず、プラン・互換性を確認して判断する                         |
| プラン         | 組織は Free                                                                                                                                  | 使用量・残容量・バックアップ実在は未確認。有料化・キー発行は行わない                                                                                                                                                       |

準備した [migration](../apps/api/supabase/migrations/20261006024617_optimize_user_rls_and_category_budget_lookup.sql) は、
8テーブルの TRUNCATE を PUBLIC / anon / authenticated から除外し、users の本人判定を `(select auth.uid())` にし、
`category_budgets(category_id)` の index を追加する。
既存8テーブルの作成者である postgres の public default privileges からも TRUNCATE を除外する。
[PostgreSQL の仕様](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html)上、作成時のroleにのみ適用される。
supabase_admin など別roleの作成、後続の明示GRANT、global default privileges による再付与は防げない。
管理roleの既定値は変更せず、適用前・新テーブル追加時に作成者とglobal/schema既定権限を確認する。行・列・通常 CRUD 権限、Book 境界、予算履歴、RPC 契約は維持する。
根拠は実権限、Advisor の users InitPlan / 外部キー index 指摘と
[RLS性能指針](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select)。
index 作成は書込待機と追加容量を伴うため、実データ規模と実行時間・lock timeout を確認して適用を承認する。

Prd 固有の `public.rls_auto_enable()` は SECURITY DEFINER・anon EXECUTE の Advisor 警告があるが、
戻り型は event_trigger。通常 RPC と同じ実行可能性を前提にせず、公開範囲・event trigger 経路を追加確認する。
認証済み向け4つの SECURITY DEFINER RPC は既存のユーザー同期・月次予算境界を担うため、
警告だけで削除・SECURITY INVOKER 化しない。unused index も履歴取得・外部キーを考慮し削除しない。
[Data API の自動公開変更](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)も確認し、
新テーブルの自動権限付与を前提にしない。今回は新テーブル・権限拡張を追加しない。

#### 隔離検証と性能の限界

ネットワーク・公開 port のない専用 PostgreSQL 17.6.1.167 に repo の既存 migration を適用し、
ローカル Auth の `auth.uid()` / `auth.jwt()` 定義を読み取りで補完した。共有 Dev・本番データは使わない。
[境界テスト](../apps/api/supabase/tests/publication_boundaries.test.sql) は2利用者の合成データで本人/profile更新、
別 Book の参照・更新・削除・挿入拒否、JWT切替・欠落、匿名RPC拒否、TRUNCATE拒否を確認し rollback する。
変更前の39項目の試験では19件が失敗し、TRUNCATEで他利用者の支払いも消えることを検出。
変更後は本人更新の反映、将来表のTRUNCATE拒否とCRUD・service_role/所有者の権限維持を確認。
既存の同期・月次予算の更新境界・timezone試験を含め4ファイル425項目が成功した。
将来表の追加8項目は既定値変更前に4件失敗し、変更後にすべて成功した。
Google OAuth・既存sessionのブラウザ実機確認やHostedの列権限全経路の証明は含まない。

性能診断は100合成利用者/Book、500カテゴリ、支払い10万件、カテゴリ予算6万件、月次予算1.2万件。
単一接続の authenticated role、ANALYZE 後の EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) を各条件8回実行し、
初回を除く7回の中央値を比較した。変更前は同じ合成DBのtransaction内でusers policyと追加indexを戻し、rollbackした。
想定公開規模・同時利用・許容応答時間は未指定であり、この診断条件を目標負荷に置き換えない。

| SQL診断                   | 変更前 → 後（ms） | 結果の限界                                          |
| ------------------------- | ----------------- | --------------------------------------------------- |
| users本人取得             | 0.119 → 0.106     | 1件を維持。小規模の差だけで改善効果を一般化しない   |
| Book・月指定の支払い一覧  | 2.570 → 5.085     | 1000件、shared hit 1015で同一。高速化は確認できない |
| 月次集計 RPC              | 5.070 → 6.824     | RPC全体の計画であり内部計画・DB負荷を網羅しない     |
| 有効月次予算 RPC          | 2.403 → 3.080     | 本番性能を保証しない。比較のばらつき・悪化を残す    |
| category_idによる予算検索 | 3.064 → 0.898     | 120件を維持。追加indexを使用、shared hit 546 → 129  |

HTTP遅延、p95/p99、同時実行、CPU/IO/接続上限、APIエラー率は未測定。
支払い一覧・カテゴリ集計は pagination なしなので、Hosted max_rows 超過時の欠落を隔離 Data API で追加確認する。
取得上限を下げたりデータを切り捨てたりして性能改善としない。目標負荷を確定してから同条件で比較する。

#### 適用・監視・復旧

- 適用前に project/ref・commit・migration・lock/容量影響・切り戻しを示し承認を得る。
  まず隔離検証し、共有 Dev の反映は[既存運用](development-preview.md)の所有者承認に従う。
  本番も別途承認し、適用後に履歴・policy・index・TRUNCATE権限・Advisorを読み戻す。
  Googleログイン、既存session、通常CRUDと過去予算を実機確認するまで完了扱いしない。
- 切り戻しは追加indexの削除とusersの2 policyを元の `auth_user_id = auth.uid()`（UPDATEのWITH CHECKも同じ）へ戻す。
  将来表の既定値の切り戻しは postgres の public default privileges に anon / authenticated の TRUNCATE を戻す。
  既存表には反映されない。TRUNCATE復元は全8テーブルへ anon / authenticated の元権限を戻す操作であり、データ保護を弱める。
  障害原因を確認し、必要な対象・リスクへの別途承認がある場合だけ復元する。migration履歴を削除・改ざんしない。
- Dashboard の Database Reports / Query Performance・Auth/Data API Logs・Usageで、遅いクエリ、5xx/timeout、
  Auth拒否、接続数、CPU/IO、DB容量、MAU・egressを確認する。pg_stat_statementsは両環境で有効。
  閾値・確認担当・確認頻度、現在使用量と残容量は未確定で、監視設定済みとは扱わない。
- Free は低活動によるpause、提供される復旧機能や保存期間に制限がある。
  [本番準備基準](https://supabase.com/docs/guides/deployment/going-into-prod)と
  [使用量・制限](https://supabase.com/docs/guides/platform/manage-your-usage)を現行プランと照合する。
  [バックアップ指針](https://supabase.com/docs/guides/platform/backups)に従い、Freeでは定期的な外部保管を検討する。
  保管先・暗号化・RPO/RTO・復旧担当を確定し、別環境へrestoreしてBook境界・件数・予算履歴を照合する。
  今回は本番データのexport/restore、課金、backup配信は行っておらず、復旧可能性は未確認。

### ブランド変更で維持する境界

- Googleログインのproviderと認証経路を変更しない。
- Supabase Project ID、database、RLS policy、利用者ごとのデータ分離を変更しない。
- brand表示の変更を理由にOAuth client secretを再生成しない。

### Production deployment

`Deploy Production` は手動実行とする。Workers への初回切替は
[#1867](https://github.com/kosnu/savings/issues/1867) と[移管手順](workers-migration.md)に従い、
対象 commit と実施内容への承認を得てから行う。
Web ビルドでは従来の Supabase・Sentry 環境変数を維持する。
本番で既存 session、Google ログイン、SPA の直接アクセス、Sentry の受信と source map 解決を確認する。

### Development previews

共有 Dev Supabase project を1つ用意し、DB・Auth・Data API を全ブランチで共有する。
本番 project、データ、OAuth 設定から分離し、合成データだけを使う。
フロントエンドは専用 Worker `burneto-dev` の native Previews で配信する。
`cloudflare.config.ts` は Preview context または development mode で本番 domain を外す。
CloudからもPRのpreviewラベルでGitHub Actionsを起動する。配信経路はActionsに統一し、native cfコマンドを使用する。
利用者は PR を選び、SHA は CI が内部で解決・固定する。main 導入後は PR 番号だけの手動実行も使える。Actions は既存 development
Environment の所有者本人による required review（自己承認可）を経て、承認後も対象 SHA を再照合する。
プレビュー配信は migration、seed、reset、Auth 設定の変更を行わない。
DB 変更は別の dev-db ラベルで専用 CI を起動し、選択 PR の固定 SHA の SQL 確認・所有者承認後に適用する。
FE/DB とも development Environment を使い、DB stepだけへ管理tokenを渡す。共有DBの更新は全 branch を直列化する。履歴競合は CLI 標準の version 検査に従い、適用済み SQL の内容変更を独自検知しない。
マージ前に新 table を適用してから、同じ PR head の FE を配信できる。
初期設定、公開範囲、共有 DB の適用・復旧、削除条件と実機検証は
[Dev プレビュー運用](development-preview.md)を参照する。

DevのSecret名は本番と揃え、Dev用developmentと本番productionで値とEnvironmentを分離する。DBはDev限定 `SUPABASE_ACCESS_TOKEN` と
`SUPABASE_PROJECT_ID` によるCLI link/db pushを使う。恒久DB password・host・CA登録は不要。
具体的なscopeと承認、共通developmentでのSecretの渡し方は[開発Preview運用](development-preview.md)を参照する。
