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

Devと隔離環境で、以下の確認を行う。Prdは操作しない。
データ操作には合成データを使う。設定の確認中は値を変更しない。
設定変更・DB適用・配信が必要な場合は[Devプレビュー運用](development-preview.md)に従う。

## 必要な情報

| 情報                        | 確認場所                                                    |
| --------------------------- | ----------------------------------------------------------- |
| Dev Preview URLと対象commit | 対象PRのDev配信結果                                         |
| Dev API URLと公開用キー     | Dev DashboardのConnect、Project Settings → API Keys         |
| テスト利用者A・B            | DevにGoogleログインでき、互いのBookに所属しない2アカウント  |
| A・Bのアクセストークン      | 各ブラウザの開発者ツール → Network → API要求のAuthorization |
| Book・支払い・カテゴリのID  | Devで作った合成データのAPIレスポンス                        |

キーはpublishableまたは既存anonキーを使う。secret/service_roleキーは使わない。
トークン・秘密値は手元だけで扱い、Issue・PRに貼らない。

## 1. Hosted APIのデータ分離

### 公開設定

Dev Dashboard → Integrations → Data API → Settingsを開く。

- Data APIが有効であることを確認する。
- Exposed schemasに`public`が選択されていることを確認する。

### 支払いの参照

1. 別ブラウザプロファイルでDevアプリにA・Bとしてログインし、それぞれ合成支払いを1件作る。
2. 開発者ツール → Network → Fetch/XHRで`payments`要求を選ぶ。
   通信先がDev API URLであることを確認し、A・Bのトークンと支払いID・Book IDを控える。
3. 次のcurlコマンドをターミナルで実行する。`<…>`を手元のDev情報に置き換える。

```sh
curl --include --silent --show-error \
  '<DEV_API_URL>/rest/v1/payments?select=id,book_id,amount&id=eq.<Aの支払いID>' \
  --header 'apikey: <Dev公開用キー>' \
  --header 'Authorization: Bearer <Aのアクセストークン>'
```

同じURLでAuthorizationだけを切り替え、次の結果になることを確認する。

| 実行者 | Authorization                | 期待結果             |
| ------ | ---------------------------- | -------------------- |
| A      | Aのトークン                  | Aの支払いが1件返る   |
| B      | Bのトークン                  | 空配列または権限拒否 |
| 未認証 | ヘッダーを削除。apikeyは残す | 空配列または権限拒否 |

4. Bの支払いIDでもA・Bを逆にして確認する。
5. URLの`id=eq.<ID>`を`book_id=eq.<相手のBook ID>`に置き換え、相手の支払いが返らないことを確認する。
   条件を外した`/rest/v1/payments?select=id,book_id,amount`でも、本人が所属しないBookの行が返らないことを確認する。

### 支払いの変更

Devアプリで正常に成功した作成・更新・削除要求をNetworkで右クリックし、Copy → Copy as cURLでコピーする。
コピーしたコマンドをターミナルで実行する。
合成データを対象に、次の箇所だけを変えて送信する。

| 操作                         | 変更箇所                                | 期待結果              |
| ---------------------------- | --------------------------------------- | --------------------- |
| AからBの支払いを更新・削除   | 対象の支払いIDとBook条件をBのものにする | Bの支払いが変わらない |
| AからBのBookへ支払いを作成   | 本文のbook_idをBのBook IDにする         | 作成されない          |
| Aの支払いをBのBookへ移動     | 更新本文のbook_idをBのBook IDにする     | 移動できない          |
| Aの支払いにBのカテゴリを設定 | category_idをBのカテゴリIDにする        | 関連付けられない      |
| 未認証で作成・更新・削除     | Authorizationを削除                     | 変更されない          |

変更されなかったことは、所有者として再取得して確認する。

### 他のテーブル・列・RPC

API Docsで`public`の以下のテーブルを開き、参照は支払いと同じ方法で確認する。
`id`・`book_id`等の条件は、そのテーブルの列に合わせる。

- `users`：本人のプロフィールだけが返る。
- `books`：本人が所属するBookだけが返る。
- `book_members`：本人の所属情報だけが返る。
- `categories`・`category_budgets`・`monthly_budgets`：本人が所属するBookのデータだけが返る。
- `category_pins`：本人のピンだけが返る。

テーブル・列の変更とRPCは、Devアプリの正常要求と対象migrationの権限を基準に確認する。

- 正常要求が成功することを確認してから、実行者をB・未認証に変え、Aのデータを変更できないことを確認する。
- `users`の更新は`name`・`language`が成功し、`auth_user_id`の変更が拒否されることを確認する。
- RPCに対象IDがある場合は相手のIDへ置き換える。対象IDがない場合は、呼び出した本人のBookだけを参照・変更することを確認する。
- アプリが呼ばない公開テーブルの変更操作・RPCも、権限を確認して試験対象に含める。禁止された操作は拒否されることを確認する。

正常要求が通らない、トークンが期限切れ、引数が不正な場合は試験をやり直す。
これらによるエラーを「他人の操作を拒否できた」と判定しない。Dashboard管理者の操作はAPI試験の代わりにしない。

## 2. セッション更新

1. Devアプリにログインし、開発者ツール → NetworkでPreserve logを有効にする。
2. タブを開いたまま、`/auth/v1/token?grant_type=refresh_token`の要求が成功するまで待つ。
3. 画面移動・再読み込み・合成支払いの作成を行う。

**合格:** 更新後も同じアカウントで操作できる。更新要求を確認できなければ未確認とする。

## 3. Auth設定

Dev Dashboard → Authenticationと、Google Auth PlatformのDev OAuth clientを開く。

| 設定                                | 確認する値・条件                                         |
| ----------------------------------- | -------------------------------------------------------- |
| Google provider                     | 有効。Dev用OAuth client IDを使用                         |
| Site URL                            | Devの代表Previewのorigin                                 |
| Redirect URLs                       | 使用するDev Previewの`/auth`が許可されている             |
| Googleのredirect URI                | `https://<Dev project ref>.supabase.co/auth/v1/callback` |
| nonce・JWT期限・session/refresh設定 | 設定値を対象Issue・PRの承認済み期待値と比較する          |
| Rate Limits・CAPTCHA                | 有効状態・値と、Googleログインに適用される範囲を確認する |

期待値が決まっていない設定や、不正利用対策が適用されない範囲は所有者へ判断を求める。
**合格:** 値が期待値と一致し、対象外の扱いが決まっている。

## 4. 配信物の秘密情報

1. Dev Previewを開き、Network / Sourcesで配信されたHTML・JSを確認する。画面移動で追加取得するJSと、公開source mapも含める。
2. Supabaseへ渡されるキーが公開用キーであることを確認する。
3. ビルドに渡す変数と配信物を照合し、管理token・secret/service_roleキー・Google client secretが含まれないことを確認する。

**合格:** ブラウザに管理用の秘密値が配信されていない。変数名の検索だけで判定しない。

## 5. 公開・管理範囲

Dev Dashboardで次を確認する。期待値が未決定の項目は、設定を変えず所有者へ確認する。

| 画面・対象                                | 確認する内容                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| Data API → Settings                       | public以外のExposed schemasがあれば、アプリで使う理由があるか                   |
| Database → Settings                       | SSL Enforcementの状態、Network Restrictionsの許可元が承認済み接続元と一致するか |
| DB接続・pooler                            | アプリ・DB適用・復旧で使う接続経路と利用者が特定されているか                    |
| Organization → Team、管理者のSecurity設定 | 各メンバーのroleが担当に合い、管理者のMFAが有効か                               |
| 管理token                                 | 対象project・権限がDB適用等の用途に必要な範囲か                                 |
| Storage / Realtime / Edge Functions       | 利用中のbucket・公開テーブル・functionに用途があるか                            |

**合格:** 不要な公開・接続・管理権限・サービスがない。例外があれば所有者の判断が残っている。

## 6. 支払いCRUDと予算履歴

試験前に、対象月の集計と現在月・過去月の予算額を控える。

1. Devアプリで合成支払いを作成し、一覧・月次合計・予算進捗が入力金額分だけ変わることを確認する。
2. 金額・日付・カテゴリを変更し、変更前後の月・カテゴリの集計が一致することを確認する。
3. 支払いを削除し、一覧から消え、集計が作成前の値へ戻ることを確認する。
4. 現在月と過去月の予算を開き、試験前に控えた予算額と一致することを確認する。

**合格:** 支払いと集計が一致し、過去予算が変わらない。所有境界は1の結果で確認する。

## 7. 取得上限

1. DevのData API設定で最大取得件数を控える。
2. 同じ上限・schema・権限・API構成の隔離環境に、上限+1件以上の合成データを用意する。
3. 一覧・月次合計・カテゴリ集計を、用意した件数・総額と比較する。

**合格:** 全件取得・集計できるか、不完全な結果であることを画面で明示する。
共有Devの上限変更・大量投入・負荷試験は行わない。

## 8. 監視条件

1. Dev DashboardのLogsでAuth・Data APIのエラーを、Reports / Usageで接続数・容量・MAU・egressを開く。
2. 各項目について、担当者・確認頻度・対応を始める条件・対応内容を所有者に決めてもらう。

**合格:** 確認先と上記4点がIssue・PRに記載されている。

## 9. 復元元・復旧範囲

1. DevのDatabase → Backupsと外部保管で、利用できる復元元の日時と取得可否を確認する。
2. DB・Auth・Storageのどこまで戻せるかを確認し、戻せない範囲と許容するデータ損失を所有者に確認する。
3. 復元を検証する場合は、合成データの復元元を別の隔離環境へ復元し、Book境界・件数・予算履歴を照合する。

**合格:** 復元元・復旧範囲が特定され、復元できない範囲を所有者が明示的に受け入れている。
復元元を確認できない場合は未確認とする。

## 10. 切り戻し

1. 変更対象ごとに、変更前の値と戻す操作を対応させる。
   DB変更ではindex・policy・既存テーブルのACL・default privilegesを含める。
2. 隔離環境で変更と切り戻しを行い、元の設定・通常操作・所有境界に戻ることを確認する。
3. 元に戻せない部分があれば明記する。適用前ACLがない場合、anon/authenticatedへの再付与だけで完全復元としない。

**合格:** 実変更に対応する手順があり、復元できる範囲と保証できない範囲が明確になっている。
共有Devの復旧は[Devプレビュー運用](development-preview.md)に従う。

## 結果の記載

Issue・PRに「Devの対象commit／確認番号／期待結果／実結果／合格・不合格・未確認」を記載する。
所有者の判断待ちも未確認とする。試験が終わった合成データは、他の検証で使っていないことを確認して削除する。

## 公式資料

- [Data APIの権限とRLS](https://supabase.com/docs/guides/api/securing-your-api)
- [APIキーの種別](https://supabase.com/docs/guides/api/api-keys)
- [セッションと更新](https://supabase.com/docs/guides/auth/sessions)
- [バックアップの範囲](https://supabase.com/docs/guides/platform/backups)
