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
  - アカウント削除・再有効化・期限後ジョブを実装またはレビューするとき
  - 退会の結果照会や削除後アクセスを確認するとき
---

# Burnetoのアカウント削除設計

[Issue #1884](https://github.com/kosnu/savings/issues/1884) の設計成果。機能は未実装。
[HTML解説](account-deletion.html)と[実装Issue案](account-deletion-implementation-issue.md)を併せて参照する。

## 基本方針と時刻

削除予約が成立すると通常利用を停止し、Auth・データ・所属を保持する。
申請から168時間未満の新しい本人Googleログインでのみ予約を取り消して再有効化する。自動refresh・既存sessionの復元では取り消さない。
復帰期限以降は再有効化できず、その期限以降で最初の午前3時（日本時間）から毎分最大10件ずつ物理削除する。

- 復帰期限 `delete_after`：DBで `requested_at + interval '168 hours'` を設定する。復帰は同じ要求をlockした後の `clock_timestamp() < delete_after` の場合だけ許可する。
- 削除開始予定 `purge_after`：復帰期限以降で最初の `Asia/Tokyo` の03:00。期限が03:00ちょうどなら同時刻、過ぎていれば翌日とする。DBで算出する値とし、重複保存しない。
- 時刻はUTCを正本とし、03:00の算出にだけ `AT TIME ZONE 'Asia/Tokyo'` を使う。DB session・端末のtimezoneや時計に依存させない。
- UIは両時刻をtimezone付きで別表示し、開始予定を完了時刻として約束しない。表示上のtimezoneを変えても処理時刻は変えない。

| 申請時刻（日本時間） | 復帰期限（168時間後） | 物理削除の開始予定（日本時間） |
| -------------------- | --------------------- | ------------------------------ |
| 10月23日02:59:59     | 10月30日02:59:59      | 10月30日03:00                  |
| 10月23日03:00:00     | 10月30日03:00:00      | 10月30日03:00                  |
| 10月23日03:00:01     | 10月30日03:00:01      | 10月31日03:00                  |
| 10月23日15:00:00     | 10月30日15:00:00      | 10月31日03:00                  |

物理削除後の復元は提供せず、その後のGoogleログインは新規登録になる。Googleアカウント自体・Google上のデータや設定は削除しない。

## 削除・保持する情報と共有家計簿

既存の [User](../harness/domain/user.md) / [Book](../harness/domain/book.md) の所有境界とcascadeを使う。
再有効化に必要なmembershipは猶予中も保持し、他memberの利用・編集は継続する。

| 対象                                                        | 猶予中                                                                                            | 期限後の物理削除                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 本人の `auth.users`・Auth identity・session/refresh         | Authユーザーとidentityを保持する。再ログインを許す。旧sessionが残ってもアプリの利用権限は戻らない | Authユーザーを削除し、従属identity/session/refreshも削除する     |
| `public.users` のemail・名前・言語等、本人のpin・membership | 保持する。通常のread/writeは停止する                                                              | 本人分をcascadeで削除する                                        |
| 本人の最後のmembershipが消えるBook                          | データ・全時点の予算履歴を保持する                                                                | Bookと支払い・カテゴリ・月次予算・カテゴリ予算の全履歴を削除する |
| 他memberが残るBook                                          | 他memberが引き続き利用する                                                                        | Book・全履歴・他memberの所属を保持し、本人の所属だけ削除する     |
| 削除要求と結果の最小記録                                    | pending要求を正本として保持する                                                                   | 完了または取消から30日保持し、その後消去する                     |
| backup・基盤の技術ログ・問い合わせメール                    | オンラインの登録情報とは別管理                                                                    | 即時の一括消去を約束しない。保持・復旧条件は下記に従う           |

削除対象は物理削除時点の全membershipから判定する。選択中Bookや入力者の `user_id` で範囲を限定しない。
猶予中の他memberの退会で共有Bookも削除対象になり得るため、申請時の件数previewを固定リストや削除許可には使わず、画面でも説明する。

## 利用者の確認と画面状態

プロフィールの既存設定行・フォーム・通知を使う。比較元は `AccountInformation`、通常logoutの `Sidebar`、`SupabaseSessionProvider` とする。
導線は `soft/red`、予約の最終確定は `solid/red`、取消は `soft/gray`、Google確認は外部連携の `outline`。
確認dialogは「アカウントの削除を予約しますか？」とし、対象identity・保持/削除範囲・共有への影響・二つの時刻・ログインによる予約取消・物理削除後の復元不可を確定前に説明する。
初期focusは取消。Enterや画面表示だけで確定せず、送信前はEscape・閉じる操作で戻れるようにする。ja/enとPrivacyの案内をそろえ、キーボード・スクリーンリーダー・モバイルでも同じ読み順と操作を提供する。

| 状態                   | 表示と操作                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| 説明の読込失敗         | 確定できない。再取得・戻る操作を提供する                                                                  |
| 本人確認・送信中       | 対象を確認して明示確定する。送信中は対象変更・確定・取消を無効化し、通信の取消を予約取消と扱わない        |
| 予約commit済み・猶予中 | 保護画面を隠してqueryを取消しcache・sessionを消去する。受付と両時刻、ログインで取り消されることを表示する |
| 予約結果未確定         | 成否を断定せず同じ受付番号で照会する。別番号で自動再申請しない                                            |
| 再有効化済み           | 予約取消を通知し、同じアカウントのデータを再取得する                                                      |
| 復帰期限以降           | 開始予定前は午前3時待ち、以後は処理待ち/遅延と示す。結果照会と必要時の運営者連絡を案内する                |
| 物理削除commit済み     | 完了と表示し、通常データを再表示しない                                                                    |
| 端末内の消去失敗       | サーバーの成否と区別し、保護画面を隠して端末内消去の再試行を案内する                                      |

他タブはsession消去を観測しcacheを消す。遅延query応答を破棄し、別アカウントへ表示を混ぜない。
別端末の既表示・ダウンロード済み情報は遠隔消去を保証しないが、予約commit以後に開始した通常データ要求はサーバーで拒否する。
予約中の自動再ログインや、結果確認のための自動Googleログインは行わない。

## 状態の正本・認可・API

状態の正本は非公開schemaの `private.account_deletion_requests` とする。`public.users` に同じ状態の重複列を追加しない。
要求は `pending` / `cancelled` / `completed` のいずれかで、同一Auth userにpendingは最大1件とする。
通常利用可能とは「本人のAuth/アプリ内userが存在し、pending要求がない」ことを指す。
pending中は期限後も通常利用を拒否する。`deleting` を永続状態にせず、ジョブ中断で処理中状態が取り残される問題を避ける。

記録項目は受付UUID、本人Auth UUID、状態、確認キーhash、申請UTC時刻・削除期限、説明version、取消/完了UTC時刻、再試行回数・次回試行時刻・最後の有限なエラー分類とする。
email・名前・明細・Google token・Auth token・自由文ログ・試行ごとの履歴は保存しない。物理削除後も結果を残せるようuserへの削除cascade FKは付けない。

| 境界                                                                       | 契約                                                                                                                                                                     |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prepare_account_deletion()`                                               | 有効な本人sessionとusersを確認し、説明・現在のBook分類件数を返す。予約や削除を行わない                                                                                   |
| `request_account_deletion(request_id, result_secret, explanation_version)` | 直近5分以内の本人sessionを検証し、pending要求・168時間の復帰期限を同じtransactionで確定する。復帰期限と算出した物理削除の開始予定を返す。対象user IDは受けない           |
| `reactivate_my_account(request_id)`                                        | 本人の新しいログインsession、対象pending要求、DB期限を検証し、cancelledへ変更する。期限後は拒否する                                                                      |
| `get_my_account_deletion_state()`                                          | 有効な本人sessionから、自分のpending状態・復帰期限・物理削除の開始予定・復帰可否だけを返す。通常データへはアクセスさせない                                               |
| `get_account_deletion_result(request_id, result_secret)`                   | sessionなしでも正しい確認キーで、その要求の `pending` / `cancelled` / `completed` と復帰期限・物理削除の開始予定だけを照会できる。不一致・記録なしは一律 `not_confirmed` |
| `private.delete_due_accounts()`                                            | Cronの管理roleだけが実行する。物理削除の開始予定・再試行時刻が来たpending要求を最大10件再検査して削除する。anon/authenticatedへ公開しない                                |

公開RPCは `SECURITY INVOKER` の薄い入口とし、必要な特権処理はData API非公開schemaの固定関数へ限定する。
特権関数は `SECURITY DEFINER`、空の `search_path`、schema修飾名とし、`PUBLIC`・anonのEXECUTEを明示的に取り消す。
authenticatedには本人向け入口と必要な内部関数のUSAGE/EXECUTEだけを付与する。
確認キーによる結果照会だけはanonにも必要な入口・内部関数の権限を与える。ジョブ・table直接権限・管理secretはクライアントへ渡さない。
内部関数を直接呼んでも同じ本人・session・時刻・確認キー検査を通す。

Authはbanしない。停止中でもGoogle認証と、本人限定の状態照会・期限内再有効化を受け付けるためである。
JWTだけの「認証済み」を通常利用の許可にせず、DBのpending状態をRLSと全特権RPCで確認する。
対象は公開tableの全read/write、プロフィール・pin・Book-owned data、認証同期、予算等の既存RPCである。
`ensure_authenticated_user` もpending中の再同期・user/default Book再作成を拒否する。初回登録はAuth実在かつpendingなしの場合だけ従来どおり許可する。
直接membership変更を許さない既存RLSを維持し、view・GraphQL・Realtime・Storageを追加公開しない。Hostedに別の公開経路があれば同じ停止条件を確認する。
既存JWTの `app_metadata` やuser_metadata、ブラウザのフラグを停止状態の正本にしない。

## Googleログインと再有効化の境界

予約の本人確認はJWTの `session_id` と `auth.sessions` の本人・実在・作成時刻を照合し、DB時刻で作成から5分以内を要求する。
再有効化はさらにsession作成時刻がその要求の `requested_at` より後であることを要求する。
refreshで変わる `iat`、通常sessionの復元、`onAuthStateChange` のイベント名だけでは新しいログインと判定しない。
これは直近のBurnetoログインの確認で、Googleのパスワード再入力を保証するものではない。

本人確認や復帰のGoogleボタンを押したときだけ、一回限りの継続marker（目的・既知なら元Auth UUID・固定復帰先・開始時刻）をsessionStorageへ保存する。
markerは5分で期限切れとし、任意return URLを受け付けない。markerそのものをサーバーの認可やsession鮮度の証拠にはしない。
本人確認・対象を指定した復帰には専用callback `/auth/account-action` を使い、通常ログインの `/auth` とpathnameで区別する。
専用callbackでは、継続の処理を通常のredirect・通常clientのURL session検出・`SupabaseSessionProvider` の認証同期より先に行う。
継続中のOAuth sessionは専用の一時storageで隔離し、SDK検証後にidentityと目的を確認するまで通常sessionへ反映しない。
元Auth UUIDと異なるidentity、OAuthエラー、marker不在/期限切れなら、継続用sessionを破棄・sign outし、通常のuser同期やdefault Book作成へ渡さない。
markerを失っても専用pathnameのcallbackを通常 `/auth` へfallbackさせない。
通常sessionへ混入させないため、元の通常sessionを別identityで置き換えない。Google側で発行されたAuth userの存在と、Burnetoのアプリ内user作成は区別する。

正しいidentityの場合だけ、申請確認ならpreview再取得、再ログインなら自分の状態照会と期限内再有効化を行う。
正常に成立した継続だけ通常sessionへ反映し、marker・一時storageを消す。失敗時は停止状態の案内に留める。
通常ログインの初回登録・redirectは維持するが、pending利用者を自動のuser同期より前に分岐する。
利用者の明示的なGoogleログインで取得した新sessionの場合だけ再有効化を試み、既存sessionの初期復元や自動refreshから再有効化RPCを呼ばない。
通常 `/auth` で明示ログインの継続情報を確認できない場合は、pending利用者を自動復帰させず、改めて復帰用のGoogleボタンを案内する。
期限後のGoogle認証成功を復帰や新規登録に読み替えず、物理削除前なら停止状態の確認だけを許可する。

## 予約・取消・物理削除の原子性と競合

[Transaction Boundaries](../harness/policies/transaction-boundaries.md)に従い、予約・取消・各物理削除をそれぞれ原子的に扱う。
すべて同じAuth UUID由来のaccount単位transaction advisory lockを最初に取得し、対象要求・Auth行・Book行の順で処理する。
ジョブはaccount lockを取得できない候補をskipし、後から再検査する。要求の状態と時刻はlock取得後の別statementで読み直す。

### 削除予約

1. 本人認証後、account lockを取り、同じ受付番号・本人・確認キーhashの要求があればその現在状態を返す。別本人/別キーでの番号再利用は拒否する。
2. Auth実在・users対応・5分以内のsession・説明versionを確認する。他のpendingがあれば重複予約せず既存要求ありと返し、本人向け状態照会へ案内する。他要求の確認キーは開示しない。
3. DBでpending要求と168時間の期限を作りcommitする。Auth・membership・登録データは削除しない。このcommitがサーバー上の利用停止時点となる。
4. 端末内消去の成功を予約成立の根拠にはしない。応答喪失なら同一受付番号の照会・再送で確認する。

### 期限内の再有効化

1. account lockと対象要求のlockを取り直し、本人・要求ID・新しいsessionを検証する。
2. DBの現在時刻が期限より前で、同じ要求がpendingのときだけcancelledへ更新しcommitする。元のデータ・所属はそのまま利用可能になる。
3. 同じ取消の再送は同じ取消結果を返す。completedや別要求を有効化しない。期限以上はジョブ未実行でも拒否する。
4. 取消後に再申請したら、新しい受付番号と新しい168時間の期限を作る。古い要求IDのジョブ・取消・再送で新しい要求を変更しない。

### 期限後のジョブ

[Supabase Cron](https://supabase.com/docs/guides/cron)からDB関数を1分おきに起動し、`pending` かつ物理削除の開始予定 `purge_after` と次回試行時刻がDB時刻以下の候補を1回最大10件処理する。
候補は開始予定・受付UUIDの順で選ぶ。03時台に限定せず、残件・失敗分・停止後の再開も以後のジョブで継続する。
時刻と件数上限で負荷を抑えるが、1件の大量削除や滞留時の昼間処理もあるため、処理容量は公開前に検証する。専用の管理roleだけに実行権限を与える。

1. 候補のaccount lockを取得し、その要求IDをlockして `pending`、`delete_after <= DB時刻`、算出した `purge_after <= DB時刻`、再試行時刻を再検査する。取消済み・古い要求・復帰期限前・物理削除の開始予定前の要求はskipする。
2. 本人Auth行と現在の全所属BookをID昇順でlockする。別statementの新しいsnapshotでmembershipを読み直す。
3. Storage所有object・不明な削除依存を検出したら停止し、metadataだけを消して成功にしない。
4. 本人 `auth.users` の1行を削除し、既存FK/triggerにより本人users・pin・membership、無人Bookと全Book-owned dataを削除する。
5. 本人Auth/users/membershipと無人Bookの残存を検査し、同じ要求をcompletedにする。この変更と削除を一緒にcommitした結果だけを削除完了とする。

各候補の削除とcompleted更新はPL/pgSQLの例外blockによるサブtransactionに含める。失敗した候補はAuth削除を含めrollbackする。
その外側でpendingを維持し、有限のエラー分類・回数・次回試行時刻を更新する。再試行間隔は1分から倍増し最大1時間とし、次回試行時刻は失敗を確認したDB時刻から設定する。
再試行でも元の `delete_after`・`purge_after` は延長・再設定しない。新たな午前3時待ちは発生せず、開始予定と次回試行時刻を満たした毎分ジョブの対象へ戻る。
バッチ全体が中断・timeoutしたら未commitの成功候補・試行情報もrollbackされ、次回の実状態から再試行する。
completed要求は再削除しない。

同じBookの最後の2memberの削除はBook lockで直列化する。実行関数は `VOLATILE` / READ COMMITTEDで待機後の新しいsnapshotを使う。
管理者のAuth Admin/直接SQL削除も同じlock規約へ参加させるか、ジョブと並行させない。既存の任意管理操作まで自動で保護済みとは扱わない。
利用者向けRPCのtimeout内で一括削除する案は採らず、ブラウザでは予約だけを確定する。
アプリ情報を先に消してAuth Admin APIを別transactionで呼ぶ方式も、片成功と補償処理を増やすため採らない。
DBからの直接Auth削除は[公式User Management](https://supabase.com/docs/guides/auth/managing-user-data#deleting-users)を根拠に採用し、対象版の権限・cascade・Auth連動を隔離環境で確認してから公開する。

## 結果未確定と照会情報の限界

ブラウザは送信前に受付UUIDとWeb Cryptoの32byte乱数の確認キーを生成し、同じ要求で使い続ける。
受付番号・確認キー・対象Auth UUID・作成時刻だけを復旧用storageへ保存し、Auth tokenを追加保存しない。
確認キーはDBでhashだけを保持し、URL・console・Sentry・問い合わせメールへ出さない。RPCで形式・長さを検査する。
匿名照会はpublishable keyだけの独立requestとし、期限切れの通常JWTを付けない。認証guardで追い出されても独立した復旧画面から利用できる。
照会は要求状態・復帰期限・物理削除の開始予定しか返さず、identity・件数・明細や通常データの取得権限を与えない。

予約・取消の応答喪失は `pending` / `cancelled` の実記録で判定する。ジョブの完了は `completed` のcommitで判定する。
`not_confirmed` は未着・処理中・失敗・不正な組合せ・記録期限切れ等を区別せず、成功や未申請と断定しない。
予約中なら、本人の新規ログインで本人限定状態照会もできる。ただし期限内の明示ログインは予約取消を伴うと案内し、単なる結果確認のため自動ログインしない。
キー紛失でも受付番号または旧Auth UUIDが残り、サーバー記録も残る場合は、運営者が本人確認後に照合する。
照合情報をすべて失った、または取消/完了記録が30日後に消えた場合は過去の結果を確定できないことがある。その場合は「確認できない」と説明し、問い合わせれば必ず完了確認できると約束しない。
現在のAuth/userの有無だけで特定の過去要求の成功を断定しない。調査のためのGoogle再登録も行わない。

## 保持・運用・公開順序

pending要求は利用停止とジョブの正本なので、物理削除まで期限なしで保持し、失敗を理由に自動消去・自動復帰させない。
cancelled/completed記録は終端UTC時刻から30日で照会不可とし、日次の保守jobで物理消去する。
端末の確認キーは終端状態を確認したら消す。未確定の端末情報は作成から30日で消し、その後の確認限界を案内する。
運営者はジョブ未起動・最後の成功時刻・物理削除の開始予定超過件数/最古age・エラー分類/回数・次回試行・記録消去遅延を確認する。復帰期限から開始予定までの予定された待機を障害による滞留と混同しない。
試行上限で放置せず、繰り返す失敗やStorage等の設計外依存を運営者が調査する。遅延を削除完了と表示しない。

運営者管理backupは最大7日とし、予約中の状態・期限・取消・完了を復旧時にも再適用する。
復旧元より後の最小の要求状態一覧を稼働系または分離保管先から取得し、通信を閉じた別環境でrestore後に適用してから公開する。
一覧は復旧元以後のcommit済み遷移を漏れなく反映した要求IDごとの最新状態であることを確認する。取消済み要求を先に反映し、現在のpending要求と元の復帰期限を再構成し、同じ日本時間03:00の規則で開始予定を再算出する。復旧時刻から新しい期限や翌朝待ちを作らない。
completed対象は記録行を戻すだけで終えず、不変のAuth UUIDに対応する復元済みAuth/usersを同じcascade境界で実際に再削除し、残存を検査する。
通常ジョブの再起動だけではcompleted対象を再削除できない。再登録された別Auth UUIDをemailで同一視して削除しない。
要求状態一覧はpending中と終端から30日の範囲で保持する。
必要な状態一覧を取得できないbackupからは本番公開へ復旧しない。保持期間・再適用・アクセス制御を確認できなければ機能を公開しない。
外部基盤の技術ログと問い合わせメールは既存Privacyの別管理を維持し、即時完全消去を約束しない。
Sentryへ受付番号・Auth UUID・確認キー・token・自由文payloadを送らず、既存の許可された診断分類だけを維持する。

公開順序はDBの要求記録・停止認可・本人RPC・ジョブ/保守・運用手順、隔離/Dev検証、Web/Privacyとする。
Authのredirect allowlistには各環境の既存 `/auth` を保ったまま、同じoriginの `/auth/account-action` を明示追加して照合する。任意URLや他環境への復帰は許可しない。
既存RPCの署名は維持し、activeユーザーの旧Webも利用できる。pending利用者を旧Webから迂回できないことを確認する。
停止認可が既存の公開経路すべてに適用され、Cronが稼働するまで新しい予約導線を有効化しない。
切り戻しは新規予約を止める。既存予約の停止・期限内復帰・期限後削除・照会・保持処理は継続し、予約を放置したり一律取り消したりしない。
重大な問題でジョブ停止が必要な場合は利用停止と取消期限を維持し、遅延として運営者が対処する。成功済み削除は復元しない。
本番適用、管理権限/Cron等の外部設定、共有Devへの変更、実アカウント試験は、対象と影響を示した別の実行承認が必要。本書はその操作許可を与えない。

## 検証する境界

隔離DBと合成ユーザーで次を確認する。実装範囲と完了条件は[Issue案](account-deletion-implementation-issue.md)に置く。

- **予約と認可**：途中失敗・応答喪失・番号の重複でも二重予約や期限延長をしない。旧JWT・refresh・別端末・旧Web・REST/RPCから停止を迂回できず、削除済みAuth IDも再作成されない。
- **再有効化とOAuth**：168時間の直前/同時/直後、lock待機、新規ログインとsession復元、別identity・古いcallback・marker紛失/期限切れを照合する。取消後の再申請や古い要求が別の予約へ作用しない。
- **時刻と分割処理**：03:00直前/同時/直後、UTC日付差、端末時計・timezoneの違いでも繰り上げ削除しない。11件以上、ジョブ停止後の再開、再試行で上限と元の開始予定を守る。
- **削除と共有**：最後の2memberの同時削除、Storage依存、SQL例外、完了記録失敗、ジョブ中断/二重起動を試す。部分削除・無人Bookの残存・共有データの誤削除を防ぐ。
- **結果と復旧**：reload・遅延応答・照合情報紛失・30日の照会期限で成功を誤表示せず、別アカウントへcacheを混ぜない。各状態を含むbackup復旧、新旧DB/Webの混在、切り戻しでも元の要求状態と期限を維持する。
- **Hostedの実動作**：承認されたDevでGoogleの新session・callback隔離・期限内復帰・Cronを確認する。午前3時の集中と実データ規模相当のデータで、1分/10件の容量・timeout・再試行による滞留解消を測る。HTMLやMSWの成功で代替しない。

## 根拠と参照

- [既存Auth連携・cascade・RLS](../../apps/api/supabase/migrations/20260621000000_link_users_to_auth_users.sql)、[Book所有への移行](../../apps/api/supabase/migrations/20260508000000_remove_user_ownership_from_book_owned_data.sql)。
- [Transaction Boundaries](../harness/policies/transaction-boundaries.md)、[Temporal Data Policy](../harness/policies/temporal-data.md)、[インフラ構成](../infrastructure.md)、[Supabase Dev検証](../supabase-dev-verification.md)、[Sentry運用](../sentry-monitoring.md)。
- [Burneto Design System](../../DESIGN.md)、[Web Design Rules](../../apps/web/docs/policies/design-rules.md)。
- [Supabase User Management](https://supabase.com/docs/guides/auth/managing-user-data)、[Sessions](https://supabase.com/docs/guides/auth/sessions)、[Database Functions](https://supabase.com/docs/guides/database/functions)、[Cron](https://supabase.com/docs/guides/cron)。Auth削除後も発行済みJWTは期限まで残り得るため、UI logoutだけに依存しない。
- [PostgreSQL日時・timezone変換](https://www.postgresql.org/docs/17/functions-datetime.html#FUNCTIONS-DATETIME-ZONECONVERT)、[lock](https://www.postgresql.org/docs/17/explicit-locking.html)、[isolation](https://www.postgresql.org/docs/17/transaction-iso.html)、[PL/pgSQLのエラー処理](https://www.postgresql.org/docs/17/plpgsql-control-structures.html#PLPGSQL-ERROR-TRAPPING)。日時・Cronは2026-10-23、その他の公式仕様は2026-10-22に確認。
