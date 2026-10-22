---
title: Burnetoのアカウント削除設計
doc_type: design
status: draft
area: repository
applies_to:
  - apps/api/supabase
  - apps/web/src/features/profile
  - apps/web/src/providers/supabase
topics:
  - account-deletion
  - auth
  - privacy
  - transaction
when_to_read:
  - アカウント削除を実装またはレビューするとき
  - 退会の結果照会や削除後アクセスを確認するとき
---

# Burnetoのアカウント削除設計

本書は [Issue #1884](https://github.com/kosnu/savings/issues/1884) の設計成果である。
実装担当者と運営者が、削除するもの、利用者の意思確認、処理の境界、障害対応を同じ条件で判断できるようにする。
以下は後続実装の設計であり、現在提供済みの機能・本番環境で確認済みの動作を表すものではない。
本タスクではアプリ・DB・外部設定を変更せず、実データを削除しない。

## 削除の意味

利用者は設定のプロフィール内「アカウントを削除」から、対象と影響を読み、直近のGoogleログインで本人を確認し、最後に明示的に確定する。
削除はBurnetoのオンラインの認証情報と登録情報へ反映する。猶予期間・利用者向け復元・確定後の取消は設けない。
ログアウトはデータを残す別の操作として維持する。Googleアカウント自体、Google上のデータや設定は削除しない。

| 対象                                                                | 削除後の状態                                                                                                           |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 本人の `auth.users`、Authが管理するidentity・session・refresh token | Auth userを物理削除し、従属データも削除する。外部Google identityそのものの削除・OAuth連携解除は行わない                |
| 対応する `public.users`                                             | email・名前・言語等のアカウント属性を含め削除する                                                                      |
| 本人の `category_pins`、`book_members`                              | 削除する                                                                                                               |
| 本人の退会でmemberが0になるBook                                     | Bookと支払い・カテゴリ・月次予算・カテゴリ予算の全履歴を削除する。無効化された予算・過去月も含む                       |
| 他memberが残るBook                                                  | Book・全履歴・他memberの所属を保持する。退会者が入力したという理由で支払い等を削除しない                               |
| 結果照会用の完了記録                                                | 下記の最小項目だけを30日保持する。プロフィール・明細・認証tokenは保持しない                                            |
| 復旧用バックアップ・基盤の技術ログ・既存の問い合わせメール          | オンラインの登録情報とは別管理。即時の一括消去や利用者向け復元を約束しない。保持条件と復旧時の削除再適用を下記に定める |

既存の [User](../harness/domain/user.md) / [Book](../harness/domain/book.md) の所有境界を維持する。
Book-owned dataを入力者の `user_id` で消す方式にはしない。
複数Bookの作成・選択・共有管理・所有権移譲・exportは追加しない。
ただし、削除処理は選択中Bookだけでなく本人の既存membershipすべてを扱う。これは削除漏れと他memberへの誤削除を防ぐ内部の安全条件である。

## 利用者の確認と画面状態

プロフィールの既存の設定行と共通のフォーム・通知を使う。
危険操作への導線は `soft/red`、最終確定は `solid/red`、取消は `soft/gray`、Google確認の開始は外部連携の `outline` とする。
説明は設定ページの本文へ置き、長い説明を確認ダイアログへ詰め込まない。
最後の短い確認ダイアログは「アカウントを削除しますか？」をタイトルにし、対象アカウント、取り消せない結果、取消・削除ボタンを示す。
初期focusは取消に置き、Enterや画面を開いただけでは削除しない。処理前はEscape・閉じる操作で取り消せる。
読み順・ラベル・focus・エラー通知はキーボードとスクリーンリーダーでも成立させる。

確定前に次を説明する。ja/enで意味を揃え、[Privacy表示](../../apps/web/src/i18n/resources.ts)の「アカウント削除未提供」も機能公開時に更新する。

- 画面のGoogleログインアカウントと、削除するBurnetoアカウントが一致していること。
- 削除する登録情報、共有中の家計簿に残る情報、Googleアカウントは消えないこと。
- 取り消し・復元はできず、再びGoogleログインすると新規アカウントになること。
- 結果確認のため最小の完了記録を30日保持すること。バックアップ・技術ログ・問い合わせの別管理とPrivacyへのリンク。

DBが作るpreviewは、本人identity、消えるBook数・残るBook数、説明のversion、membership構成の指紋を返す。
他memberの名前・emailは返さない。対象を取得できない場合は確定できない。
指紋はBook IDとmemberの構成から作り、削除対象の分類が変わったら再確認を要求する。支払いの追加は指紋に含めず、「確定時点の全登録情報」が対象と明記する。

| 状態                        | 確認できること・許可する操作                                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 対象の読込中・取得失敗      | loadingまたはエラーを示す。削除不可。取得の再試行・戻る操作ができる                                                              |
| 説明・本人確認              | 対象と影響を読み、取消またはGoogleで確認する。ここでは削除要求を送らない                                                         |
| 最終確認                    | Google確認後にpreviewを取り直す。明示的な削除確定、または取消ができる                                                            |
| 送信中                      | 確定・取消・対象変更を無効にしボタン内spinnerを示す。画面離脱や通信取消を削除の取り消しとは表示しない                            |
| DBがrollbackを明示した失敗  | 完了表示を出さない。既存情報が維持される。理由に応じ、対象再取得・本人確認・同一要求の再試行・戻る操作を示す                     |
| 応答喪失・timeout・結果不明 | 「削除結果を確認できません」と受付番号を示す。「結果を確認」から照会する。自動の新規要求・自動Googleログイン・完了表示を行わない |
| 削除commit確認済み          | 保護画面を直ちに隠し、当該ブラウザのsessionとアカウント由来cacheを消去し、トップへ遷移して一時的な完了通知を出す                 |
| 完了後の端末内消去に失敗    | サーバー削除済みと端末内消去の失敗を分けて案内し、保護画面を再表示しない。消去の再試行ができる                                   |

既存の `AccountInformation`、通常logoutの `Sidebar`、`SupabaseSessionProvider` を比較元にする。
通常logoutのlocal scopeと既存session同期を維持し、退会完了時は進行中queryの取消・cache消去・遅延応答の破棄を行う。
他タブも同じ認証消去を観測してcacheを消す。別端末に既に表示済み・保存済みの情報を遠隔消去できるとは約束しない。
別端末の次の保護データ要求はサーバーで拒否し、画面の再認証案内へつなぐ。

## 実行方式と認可

[Transaction Boundaries](../harness/policies/transaction-boundaries.md)に従い、PostgreSQLの単一transactionを実行境界にする。
本人限定のRPCが `auth.users` の本人1行を削除し、既存cascadeと完了記録の作成を同じtransactionに含める。
Supabaseの[User Management](https://supabase.com/docs/guides/auth/managing-user-data#deleting-users)は直接削除を案内している。
管理対象schemaへ依存するため、対象版での権限・FK・Auth sessionの連動削除を実装時の隔離環境で検証し、未確認のまま公開しない。

| 比較した方式                                                                | 判断と理由                                                                                                |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| DB RPCによる本人削除・cascade・完了記録                                     | 採用。既存DB構成に閉じ、どれか1つの失敗で全体rollbackできる                                               |
| サーバーからAuth Admin APIを呼び、別transactionでアプリ情報・完了記録を更新 | 不採用。新しいサーバーと管理secretを要し、Auth削除と結果記録の片成功への補償が増える                      |
| ブラウザから関連tableを順に削除                                             | 不採用。原子性と他ユーザーの保護を保証できない                                                            |
| soft delete・猶予期間・非同期queue                                          | 不採用。残存認証・保留・復元・再試行の状態を増やす。現在の所有モデルでは同期の全体成功/rollbackを優先する |

新設する境界は次の3つに限定する。名前は実装の公開契約とし、既存RPCは破壊的に変更しない。

| RPC                                                                                    | 契約                                                                                                                                                                     |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prepare_account_deletion()`                                                           | 有効な本人sessionと対応するusersを確認し、上記previewを返す。削除しない                                                                                                  |
| `delete_my_account(request_id, result_secret, scope_fingerprint, explanation_version)` | UUID形式の受付番号・結果確認キー・previewの指紋・説明versionを受ける。対象user IDやemailは入力させない                                                                   |
| `get_account_deletion_result(request_id, result_secret)`                               | 受付番号と確認キーのhashが一致する完了記録だけを照会する。`completed` または `not_confirmed` を返し、アカウント情報は返さない。認証sessionの消去・期限切れ後も照会できる |

公開RPCは `SECURITY INVOKER` の薄い入口とし、削除・照会に必要な特権処理はData API非公開schema内の固定処理へ限定する。
特権関数は `SECURITY DEFINER`、空の `search_path`、schema修飾したtable・関数名を使う。
`PUBLIC`・`anon` のEXECUTEを明示的に取り消し、authenticatedへ削除・previewの入口と必要な内部関数のUSAGE/EXECUTEだけを付与する。
結果照会の入口とその内部関数だけはanon・authenticatedへ必要なUSAGE/EXECUTEを付与し、受付番号と256bitの確認キーによる限定的な照会能力で保護する。
tableの直接権限や管理キーをブラウザへ渡さない。内部関数を直接呼んでも、削除は同じ本人・session・引数検査、照会は同じ確認キー検査を通す。
削除用roleの必要権限と実所有者をmigrationで明示し、RLSを迂回する汎用関数・任意SQL・任意user指定は設けない。

本人確認はDBの `auth.uid()` とJWTの `session_id` に結び付く `auth.sessions` の実在・同じuser・作成時刻を使う。
削除にはDB時刻で作成から5分以内のsessionを要求する。JWTの `iat`、ブラウザ時刻、user_metadata、入力emailを鮮度・認可の根拠にしない。
Google OAuthをやり直し同じAuth userへ戻ったことを確認する。refreshだけで鮮度が延長されてはいけない。
違うGoogleアカウントを選んだ場合は元の確認を破棄し削除しない。5分超過なら再確認する。
これは直近のBurnetoログインの確認であり、Googleのパスワード再入力を保証するものではない。

Google確認の開始前に、元Auth user ID・固定の確認画面への復帰先・一回限りの継続markerをsessionStorageへ保存する。
既存の `/auth` callbackで、この継続だけを通常のトップ/支払い画面へのredirectより先に扱う。
SDKのOAuth検証を通した新sessionの本人が元IDと一致した場合だけ、markerを消費して確認画面へ戻りpreviewを再取得する。
任意のreturn URLを受け付けず、marker自体を認可や鮮度の証拠にはしない。
中断・OAuthエラー・別identity・marker不在/期限切れでは削除を開始せず、markerを破棄する。
継続markerの期限は開始から5分とし、通常のGoogleログインは既存の遷移を維持する。

## 原子性・競合・完了の判定

削除関数は `VOLATILE` / READ COMMITTEDで、次を別SQL statementとして同一transaction内で行う。

1. 本人・受付番号・確認キーhashに対応する既存完了記録があれば、削除を繰り返さず同じ `completed` を返す。別本人または別キーによる受付番号の再利用は拒否する。
2. 本人のAuth userをlockする。待機後は同じ完了記録を再検査し、先行要求が成功していればその完了を返す。記録がない場合だけ、有効な本人session・5分の鮮度・usersの対応・説明versionを検証する。
3. 本人の全所属BookをID昇順で `FOR UPDATE` する。lock待機後の新しいsnapshotでmembership構成と指紋を照合する。
4. 指紋の不一致、Storage所有object等の対象外依存、不明な削除依存があれば、何も消さずエラーにする。
5. 本人Auth userを1件削除する。users・pin・membership、無人Bookとそのデータは既存FK/triggerで削除する。
6. 本人Auth user・対応users・membershipが残らず、対象だったBookに無人の残存がないことを検査し、完了記録を作る。失敗したらすべてrollbackする。
7. commitされた完了記録だけを成功の根拠にする。Auth未検出、401、空のレスポンス、clientのsignOut成功だけでは成功にしない。

Book lockは、同じBookの最後の2人の同時退会が互いの未commit membershipを見て空Bookを残す競合を防ぐ。
同じ本人の重複要求・異なる受付番号の競合もAuth user lockと再検査で一度だけ削除する。
別番号の要求が先行commit後に本人不在となり、その番号の完了記録もない場合は未確定として扱う。他の番号の確認キーを開示せず、運営者が本人UUIDから先行の完了記録を確認する。
通常のmembership直接INSERT/UPDATE/DELETEは既存RLSで許可しない。既存の認証同期は新しいBookと本人membershipを作る経路として維持する。
管理者によるAuth Admin削除・SQL直接削除は同じBook lock規約へ参加させるか、利用者の退会と並行させない。
本設計はRLSを迂回する任意の管理操作との同時実行まで保証するものではない。
管理者の通常手順にもlockと残存検査を含める。運用上これを守れない場合は、公開前に共通の削除境界へ統一する。

受付番号と、Web Cryptoの乱数による32byteの確認キーは送信前に一度生成し、同じ要求の再送で変更しない。
結果不明中は受付番号・確認キー・対象Auth user ID・作成時刻を当該ブラウザの復旧用storageへ保持する。
確認キーは受付番号とは別物で、DBはhashだけを保持し、URL・console・Sentry・問い合わせメールへ載せない。RPCの引数の長さ・形式を検査する。
Auth tokenを結果確認用に別途永続保存しない。通常のsession消去や別アカウントへの切替で、復旧用storageを別ユーザーのアカウント操作に使わない。
結果照会はsessionを必要としない独立した復旧画面からも呼べるようにし、reload時に通常の認証guardで設定画面から追い出されても利用できる。
照会の通信はpublishable keyだけを使う独立した匿名requestとし、既存SDKの期限切れJWTをAuthorizationへ付けてRPC到達前に拒否される経路を避ける。
有効な組合せ以外は一律 `not_confirmed` とし、存在有無・本人identity・データ件数は開示しない。
これは完了の有無しか返さない照会能力であり、保護されたアプリ情報へのアクセスや削除権限には使わない。
完了の確認後は確認キーを消す。未確定の復旧用storageも作成から30日で消す。

`not_confirmed` は処理中・未着・rollback・記録期限切れ等を区別しない。未削除や失敗確定とは表示しない。
元sessionがまだ有効な場合だけ、同一受付番号での再送を明示操作として許可し、サーバーで対象・鮮度・指紋を再検査する。
確認キー/番号の紛失・30日経過・照会障害なら未確定のまま、Privacyの運営者連絡先と受付番号を案内する。JWT失効だけでは照会不能にしない。
結果確認のためのGoogle再ログインは、新規登録を生む可能性があるため自動で行わない。
再試行を自動queueへ積まず、応答待ちtimeoutだけで元処理の中止を推論しない。

## 削除後のアクセスと依存境界

Supabaseの[User Management](https://supabase.com/docs/guides/auth/managing-user-data#removing-account-access)と
[Sessions](https://supabase.com/docs/guides/auth/sessions)にあるとおり、Auth userの削除だけで発行済みaccess JWTは即時失効しない。
削除commit後は、users・membershipの不在により通常のRLSを拒否し、特権RPCもAuth user/usersの実在確認で拒否する。
`ensure_authenticated_user` は削除済みAuth IDを復活させてはいけない。Auth FKを残し、古いJWTで再同期・新規Book作成ができないことを検証する。
refresh token・sessionはAuth userの削除に連動して失効させる。
JWT期限の短縮やUIのlogoutだけを代替策にしない。削除前に開始済みのrequestや既にダウンロード済みの情報を取り戻せるとは保証しない。

確認する経路はRESTの全公開tableのread/write、既存の認証同期・予算RPC、新設削除/照会RPCである。
view・GraphQL・Realtime・Storageを新たに有効にしない。Hostedの実公開経路が増えている場合は同じ本人実在・membership条件を照合してから有効化する。
Storage所有objectが存在する場合は処理を拒否する。object metadataだけをSQLで削除して完了にせず、Storage APIを含む削除設計が必要な範囲として扱う。

## 保持記録・運用・公開順序

完了記録は非公開schemaに置き、`request_id`、確認キーhash、削除したAuth user UUID、完了UTC時刻、説明versionだけを保持する。
削除済みuserへのFKは付けず、直接のSELECT/書込をanon・authenticatedに許可しない。email・名前・支払い・Google tokenを保存しない。
DB時刻で完了から30日後に期限切れとし、照会不可にする。日次のDB保守jobで期限切れ記録を物理削除し、失敗と最古記録のageを運営者が確認できるようにする。
運営者は既存の管理経路で受付番号を使い、完了記録とAuth user/usersの有無・無人Bookの残存を照合する。
完了記録がないだけで削除成功を断定せず、本人確認と残存確認の結果を説明する。調査のためのGoogle再登録は行わない。

バックアップ・技術ログの保持は現在のPrivacyの別管理を維持し、即時完全消去を約束しない。
運営者管理の復旧用backupは最大7日、完了記録は30日とし、backupから退会済みアカウントを再公開しない。
復旧では、通信を閉じた別環境へrestoreし、復旧元より後の完了記録を稼働系または別保管した最小の削除一覧から再適用してから公開する。
一覧も完了から30日で消去する。復旧点以後の削除一覧を取得できないbackupは本番公開へ復旧しない。
既存backupが7日を超える、保持条件を確認できない、削除一覧の分離保管・再適用ができない場合は機能を公開しない。
外部基盤の技術ログと問い合わせメールは、既存Privacyに従う目的・保持条件を案内する。削除UIに「すべての情報が即時消える」と書かない。
Sentryへは自由文・受付番号・Auth user ID・token・削除要求payloadを送らず、既存の許可された診断分類だけを維持する。

実装の公開順序は、DBの非公開記録・権限・RPC・期限切れ処理・運用手順、隔離/Devでの検証、Web/Privacyの順とする。
新規追加だけにし、旧Webと既存RPCを維持する。DB配備失敗時はWebの導線を有効化しない。
切り戻しは新規削除要求を止めるところまでとし、成功済みの削除を復元しない。照会・保持期限処理は継続する。
本番変更・管理権限追加・外部設定変更・実アカウント試験は、それぞれ対象と影響を提示した別の実行承認が必要である。
本書はその操作許可を与えない。Hosted設定・実ACL・backup/技術ログの実保持期間は公開前の照合項目であり、本設計で確認済みとは扱わない。

## 後続実装の完了条件と検証

設計から機能公開までを一つの実装Taskで扱い、原子性・状態表示・Privacy・運用を別々に完成扱いしない。
次の観測条件を実装Issueへ引き継ぐ。実データを使わず、ローカル/隔離DBと合成ユーザー・合成データを使用する。

| 観測条件                                                                       | 必要な結果                                                                                                                                               |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 未認証、他人指定・偽sub・失効JWT・古いsession・refreshのみ                     | 削除拒否。誰の登録情報も変化しない。確認キーのない照会は一律 `not_confirmed` で情報を開示しない                                                          |
| 説明読込失敗・対象不明・Google別アカウント・取消                               | 削除要求が送られない。設定とデータが維持される                                                                                                           |
| 本人のみのBookで成功                                                           | Auth/identity/session/refresh、users、pin、membership、Bookと全時点の予算を含む従属情報が消え、完了記録だけ残る                                          |
| 他memberが残るBookで成功                                                       | 他memberの利用・データ・予算履歴が維持され、退会者の所属だけ消える                                                                                       |
| SQL途中例外・制約違反・Storage所有object・完了記録作成失敗                     | Auth削除を含む全体rollback。完了表示なし                                                                                                                 |
| 同じ要求の並行再送・別受付番号の競合                                           | 削除は一度だけ。同じ受付番号では完了を再確認できる。別番号の競合には先行の成功を推測して返さず、未確定と運営者の確認方法を示す。他人の記録へ結び付かない |
| 最後の2memberの同時退会・対象指紋変更                                          | 空Bookが残らない。共有/削除の分類が変わった未確認対象は削除しない                                                                                        |
| commit前・後の通信遮断、reload、SDKのsession消去、token失効、受付番号/キー紛失 | 成功・失敗・未確定を混同せず、照会・同一要求再送・運営者確認へつながる。確認キーがある限り認証なしで完了を確認できる                                     |
| 削除前に保存したJWT/refresh token、別タブ・別端末                              | 新しい保護情報要求・更新・再同期・refreshが拒否される。確認キーによる照会は対応する要求の完了有無だけ                                                    |
| 完了時の遅延query応答・端末内消去失敗                                          | データが再表示されない。サーバー完了と端末の失敗を区別できる                                                                                             |
| 記録の30日境界・日次削除失敗・backup復旧                                       | DB時刻で照会期限を守り、保守失敗を検知する。削除済みアカウントを再公開しない                                                                             |
| Webのみ/DBのみの旧新版、切り戻し                                               | 既存login/logout・プロフィール設定・通常RPCが維持され、未配備RPCで導線を有効化しない                                                                     |

Webは `pnpm run web:format` の後、`pnpm run web:lint`、`pnpm run web:format-check`、`pnpm run web:typecheck`、`pnpm run web:test:unit-integration` を並行実行する。
対象storyがbrowser-testなら `pnpm run web:test:storybook` も実行する。
DBには本人/他member/同時要求・rollback・旧JWTの回帰試験を追加し、隔離Supabaseで `pnpm exec supabase test db --workdir apps/api` を実行する。
実際のGoogle新session作成・callback・同一identity復帰・refresh拒否は、承認されたDevの合成アカウントで照合する。
SQL単体・MSW・公式資料だけでHosted Auth/Data APIの実動作を検証済みとは扱わない。

設計の採用方式・削除境界・画面状態・保持期限は本書で固定する。実装者へ方式の選び直しを未決事項として渡さない。
権限・Auth cascade・timeout内の処理容量・Google callback・backup等の環境適合は後続Taskの検証対象であり、失敗したら公開せず原因と影響を報告する。
原子性を弱める、管理secretや別サーバーを追加する、復元を提供するといった設計変更は、この判断をそのまま実装済みとは扱わず影響を再評価する。

## 根拠と参照

- [#1884](https://github.com/kosnu/savings/issues/1884)が現在のIntent。[#1560](https://github.com/kosnu/savings/issues/1560)はNot plannedで終了した経緯であり、方式を拘束しない。
- [Auth連携・cascade・RLS](../../apps/api/supabase/migrations/20260621000000_link_users_to_auth_users.sql)、[Book所有への移行](../../apps/api/supabase/migrations/20260508000000_remove_user_ownership_from_book_owned_data.sql)が既存の削除対象と認可の根拠。
- [User Domain Rules](../harness/domain/user.md)、[Book Domain Rules](../harness/domain/book.md)、[Temporal Data Policy](../harness/policies/temporal-data.md)。
- [インフラ構成](../infrastructure.md)、[Supabase Dev検証](../supabase-dev-verification.md)、[Sentry運用](../sentry-monitoring.md)。ローカルの不要サービス無効化をHostedの実設定の証明には使わない。
- [Burneto Design System](../../DESIGN.md)、[Web Design Rules](../../apps/web/docs/policies/design-rules.md)。
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)、[PostgreSQLの明示lock](https://www.postgresql.org/docs/17/explicit-locking.html)、[transaction isolation](https://www.postgresql.org/docs/17/transaction-iso.html)。公式仕様の確認日: 2026-10-22。
