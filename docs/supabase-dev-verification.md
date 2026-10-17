---
title: Supabase設定変更のDev確認手順
doc_type: guide
status: accepted
area: infrastructure
applies_to:
  - apps/api/supabase
  - docs/infrastructure.md
topics:
  - supabase
  - security
  - verification
when_to_read:
  - Supabase設定変更の確認項目と操作手順を選ぶとき
  - Devで認証・権限・データ整合性・復旧を確認するとき
---

# Supabase設定変更のDev確認手順

設定変更前後の確認を、Devと隔離環境で行う。Prdへの接続・試験・設定照合・変更・配信は対象外。
合成データだけを使い、Prdのデータ・ユーザー・バックアップはコピーしない。
この文書は操作手順を所有し、個別の確認結果はIssue・PRに残す。

必要な情報は次のとおり。秘密値は手元だけで扱い、Issue・PR・スクリーンショットへ転載しない。

| 情報                                          | 取得場所・条件                                                                                             |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Dev project/ref・API URL・Preview URL・commit | Dashboard、対象PRのDev配信結果。Networkの通信先もDevであることを確認                                       |
| Dev公開用キー                                 | DashboardのProject Settings → API Keys。publishableまたは既存anonキー。secret/service_roleは試験に使わない |
| テスト利用者A・B                              | DevアプリにGoogleログインでき、互いのBookに所属しない2アカウント                                           |
| A・Bのアクセストークン                        | 各ブラウザの開発者ツール → Network → API要求のAuthorization                                                |
| Book・支払い・カテゴリ等のID                  | Devで作った合成データのAPIレスポンス                                                                       |
| 公開schema・テーブル・列権限・RPCと引数       | Data API設定、API Docs、必要に応じてSQL Editorの読み取り照会                                               |
| 設定の期待値・運用判断                        | 対象Issue・PR、所有者の採用判断。未決定の値を推測しない                                                    |

Dashboardのメニュー名は変更されることがある。見つからない場合は同じ設定名を検索する。

## 1. Hosted APIのデータ分離

1. Dev Dashboard → Integrations → Data API → Settingsで公開schemaを確認する。
   API Docsと権限情報から公開テーブル・view・列・RPCを列挙し、各操作の許可・拒否を決める。
   Database → Tables / PoliciesでRLSも確認する。Dashboard管理者やSQL Editorの実行結果だけで利用者境界を判定しない。
2. 別ブラウザプロファイルでDevアプリにA・Bとしてログインする。各Bookに合成支払いを作る。
   開発者ツール → Network → Fetch/XHRで`payments`要求のURL・ヘッダー・レスポンスを確認する。
3. HTTPクライアントに次のGET要求を作り、A・B・未認証で送信する。`<…>`は手元のDev情報へ置き換える。

```http
GET <DEV_API_URL>/rest/v1/payments?select=id,book_id,amount&id=eq.<Aの合成支払いID>
apikey: <Dev公開用キー>
Authorization: Bearer <Aのアクセストークン>
```

| 実行者    | Authorization                  | 期待結果               |
| --------- | ------------------------------ | ---------------------- |
| 本人A     | Aのトークン                    | Aの合成支払いが1件返る |
| 別利用者B | Bのトークン                    | Aの支払いが返らない    |
| 未認証    | ヘッダーごと削除。apikeyは残す | Aの支払いが返らない    |

4. A・Bを逆にして繰り返す。相手のBook IDを指定した検索と、Book条件なしの検索でも許可外の行が返らないことを確認する。
5. Devアプリの正常な作成・更新・削除要求をNetworkから取得し、合成データを対象に複製する。
   実行者・対象ID・Book ID・所有者列・カテゴリIDを1つずつ変更し、他人のデータ変更、Book付け替え、別Bookカテゴリの関連付けを試す。
   変更許可列の正常更新と変更禁止列の拒否も確認する。未認証でも同じ変更要求を試す。
6. 公開対象の全テーブル・view・RPCに同じ許可・拒否の組み合わせを適用する。
   RPCはAPI Docsの引数と正常要求を使う。Book引数がないRPCも、実行者本人の範囲だけを扱うことを確認する。

**合格条件:** 正常操作は成立し、許可外の行・列は取得・変更できない。変更拒否は所有者による再取得で確認する。
HTTP成功でも空配列・対象0件の場合がある。トークン切れ、存在しないID、不正な引数による失敗は境界の合格証拠にしない。
元から非公開・実行不可の操作を成功させるためにgrantを追加しない。

## 2〜10. 設定・通常利用・運用の確認

| 番号・確認項目      | 画面と操作                                                                                                                                                                                     | 合格条件                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2. セッション更新   | DevアプリのNetworkでログを保持し、アクセストークンの自動更新を待つ。`/auth/v1/token`のrefresh要求成功後、画面移動・再読み込み・合成支払いの操作を行う                                          | 更新後も同じ本人として閲覧・操作できる。再読み込みだけで更新済みと判断しない                                                                             |
| 3. Auth設定         | Dev Dashboard → AuthenticationでGoogle provider、URL Configuration、session/JWT・refresh、Rate Limits、CAPTCHAを確認。Google側のDev OAuth clientのcallback等も照合する                         | 採用方針と実値が一致する。不正利用対策はGoogle経路への適用範囲・対象外とその扱いを所有者が判断している                                                   |
| 4. 配信物の秘密情報 | Dev PreviewのNetwork / SourcesでHTML・JS・遅延ロードJS・公開source mapを確認。ビルド時の注入値と配信値の種別・用途を照合する                                                                   | 公開用キーだけがブラウザへ渡り、管理token・secret/service_roleキー・Google client secretがない。文字列名の検索だけで完了にしない                         |
| 5. 公開・管理範囲   | DevのData API設定、Database設定のSSL Enforcement・Network Restrictions・接続経路、組織のメンバー権限・管理者MFA、管理tokenのscope、Storage / Realtime / Functionsの利用状態を確認              | 必要な公開範囲・接続・権限・サービスに限定され、採用理由が説明できる。`ssl=on`をSSL強制の証拠にしない                                                    |
| 6. CRUDと予算履歴   | Devアプリで合成支払いを作成→金額・日付・カテゴリ更新→削除。各段階で一覧・月次合計・予算進捗と期待値を照合。現在月・過去月の予算を取得し、1の所有境界の結果も確認する                           | 金額・件数・集計が一致し、所有境界と過去予算が維持される                                                                                                 |
| 7. 取得上限         | DevのData APIの最大取得件数を読む。同じ上限・関連schema・権限・API構成の隔離環境で上限+1件以上の合成データを用意し、一覧・集計を既知の件数・総額と照合する                                     | 全件取得・集計できるか、不完全であることを利用者に明示する。欠落した値を全件の結果にしない。共有Devの上限変更・大量投入・負荷試験は行わない              |
| 8. 監視条件         | Dev DashboardのLogs / Reports / UsageでAuth・Data APIエラー、接続、容量、MAU・egress等の確認先と現状を確認する                                                                                 | 担当・頻度・対応条件・対応内容が所有者の判断で定まっている。画面が存在するだけで監視済みにしない                                                         |
| 9. 復元元・復旧範囲 | DevのDatabase → Backupsと外部保管を確認。復元元の日時・取得可否・DB/Auth/Storage等の対象範囲を特定する。復元検証は合成データの復元元から別の隔離環境へ行い、Book境界・件数・予算履歴を照合する | 利用可能な復元元と復旧できる範囲を説明できる。復元不能部分・許容損失は所有者が明示的に受け入れる。画面を取得できないことをバックアップ不在の証拠にしない |
| 10. 切り戻し        | 実変更と変更前設定を対応させ、隔離環境で戻して比較。DBはindex・policy・既存表のACL・作成role別のglobal/schema default privilegesを、設定は元値と影響を確認する                                 | 元へ戻る部分・保証できない部分が明確。適用前ACLがなければanon/authenticatedへの再付与だけで完全復元と説明しない。migration履歴は改ざんしない             |

9・10でexport・復元・権限復元等を行う場合も、実行対象と影響への権限を確認する。
共有DevのDB更新・復旧は[Devプレビュー運用](development-preview.md)に従い、他のPreviewの検証と競合させない。
有料化・キー再発行・API互換性や利用体験を変える変更は事前確認する。

## 結果と完了の判断

既存Issue・PRに、対象環境・commit・確認番号・期待結果・実結果・判定を短く記載する。
設定変更時は秘密を含まない変更前後の値と採用理由も示す。生のヘッダー・トークン・個人データは残さない。

```text
環境 / commit: Dev / <対象commit>
確認: 1 payments UPDATE、BからAの合成支払い
期待: 変更されない
実結果: 対象0件。Aで再取得し変更なし
判定: pass
未確認・所有者判断: なし
```

期待どおりならpass、不一致はfail、未実施・証拠不足・判断待ちはunknownとする。
1件の成功を公開対象全体の成功に広げない。合成データは関係する他の検証で使われていないことを確認して片付ける。
文書の作成、隔離DB試験、Hosted実API、UI確認、配信成功は別の証拠として扱う。

## 公式資料

- [Data APIの権限とRLS](https://supabase.com/docs/guides/api/securing-your-api)
- [APIキーの種別](https://supabase.com/docs/guides/api/api-keys)
- [セッションと更新](https://supabase.com/docs/guides/auth/sessions)
- [バックアップの範囲](https://supabase.com/docs/guides/platform/backups)
