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

[Issue #1884](https://github.com/kosnu/savings/issues/1884) の設計成果。
利用者は削除を予約すると利用停止になり、7日以内の新しいGoogleログインで予約を取り消せる。期限以降は復帰できず、定期ジョブが物理削除する。
本書は未実装機能の設計であり、本番の動作・環境を検証済みとは扱わない。
[操作できるHTML解説](account-deletion.html)と[実装Issue案](account-deletion-implementation-issue.md)は本書に対応する。
本タスクでは設計と説明資料だけを更新し、機能実装・外部設定変更・実データ削除は行わない。

## 利用者に約束する動作

| タイミング                             | アカウント・データ・操作                                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 削除予約の確定                         | Burnetoの通常利用を停止する。Auth・アプリ内ユーザー・全データ・所属は保持し、端末のsessionと画面cacheを消す。予約受付と復帰期限を表示する |
| 期限より前の本人の新しいGoogleログイン | 予約を取り消し、同じAuthユーザー・所属・データで再有効化する。通常の利用へ戻る                                                            |
| 自動refresh・既存sessionの復元         | 予約を取り消さない。停止中の通常データアクセスは拒否する                                                                                  |
| 期限ちょうど・期限後                   | ジョブ未実行でも復帰不可。処理待ち・処理中・遅延を削除完了と表示しない                                                                    |
| 期限後のジョブ成功                     | Authと削除対象データを同じtransactionで物理削除し、完了を記録する                                                                         |
| ジョブの失敗・中断                     | 利用停止と予約を維持する。部分削除はrollbackし、再試行と運営者の確認へつなぐ                                                              |

「7日」は申請がDBで成立したUTC時刻から168時間である。
`requested_at` と `delete_after = requested_at + interval '168 hours'` はDBが設定する。
復帰には、同じ要求をlockした後のDB時刻 `clock_timestamp() < delete_after` が必要で、同時刻は期限切れとする。
UIはDBが返した時刻を利用者のtimezone付きで表示する。ブラウザ時計や表示上の残り時間を認可に使わない。
実際の物理削除は期限到来後のジョブ成功時であり、障害時まで含め期限ぴったりの完了を保証しない。

猶予期間中の再有効化と、物理削除後の復元は区別する。物理削除後の利用者向け復元は提供しない。
削除後のGoogleログインは新規登録になる。Googleアカウント自体・Google上のデータ・設定は削除しない。
通常のログアウト、プロフィール・言語設定は維持する。export、複数Bookの作成・選択・共有管理、所有権移譲は追加しない。

## 削除・保持する情報と共有家計簿

既存の [User](../harness/domain/user.md) / [Book](../harness/domain/book.md) の所有境界と物理削除cascadeを維持する。
猶予中はmembershipを外さない。membershipを先に削除して無人Bookを消すと再有効化できなくなるためである。
停止するのは申請者本人の利用であり、他memberの利用・編集は継続する。

| 対象                                                        | 猶予中                                                                                            | 期限後の物理削除                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 本人の `auth.users`・Auth identity・session/refresh         | Authユーザーとidentityを保持する。再ログインを許す。旧sessionが残ってもアプリの利用権限は戻らない | Authユーザーを削除し、従属identity/session/refreshも削除する     |
| `public.users` のemail・名前・言語等、本人のpin・membership | 保持する。通常のread/writeは停止する                                                              | 本人分をcascadeで削除する                                        |
| 本人の最後のmembershipが消えるBook                          | データ・全時点の予算履歴を保持する                                                                | Bookと支払い・カテゴリ・月次予算・カテゴリ予算の全履歴を削除する |
| 他memberが残るBook                                          | 他memberが引き続き利用する                                                                        | Book・全履歴・他memberの所属を保持し、本人の所属だけ削除する     |
| 削除要求と結果の最小記録                                    | pending要求を正本として保持する                                                                   | 完了または取消から30日保持し、その後消去する                     |
| backup・基盤の技術ログ・問い合わせメール                    | オンラインの登録情報とは別管理                                                                    | 即時の一括消去を約束しない。保持・復旧条件は下記に従う           |

削除範囲は物理削除時点の本人の全既存membershipから判定する。選択中Bookだけに限定せず、入力者の `user_id` を使ってBook-owned dataを直接削除しない。
猶予中に他memberも退会すると、申請時には共有だったBookが最終的に削除対象になることがある。
画面はこの規則と「確定した物理削除時点の全データが対象」であることを説明する。申請時の件数previewを7日後の固定リストや削除許可には使わない。

## 利用者の確認と画面状態

プロフィールの既存設定行・フォーム・通知を使う。比較元は `AccountInformation`、通常logoutの `Sidebar`、`SupabaseSessionProvider` とする。
導線は `soft/red`、予約の最終確定は `solid/red`、取消は `soft/gray`、Google確認は外部連携の `outline`。
長い説明は設定本文へ置き、短い確認dialogのタイトルを「アカウントの削除を予約しますか？」とする。
対象アカウント・7日の期限・ログインで予約が取り消されること・期限後の復元不可を確定前に説明する。
初期focusは取消とし、Enter・画面を開いただけでは申請しない。処理前はEscape・閉じる操作で取り消せる。
キーボード・スクリーンリーダー・モバイルでも同じ読み順と操作を提供する。ja/enの意味とPrivacy表示を同期する。

| 状態                   | 表示と操作                                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 説明・対象の読込失敗   | 削除予約を確定できない。再取得・戻る操作ができる                                                                      |
| 本人確認・最終確認     | 対象のGoogle identityと影響を確認し、取消または明示的な予約確定ができる                                               |
| 予約送信中             | 対象変更・確定・取消を無効化しspinnerを表示する。通信の取消を予約取消と扱わない                                       |
| 予約commit確認済み     | 保護画面を隠し、進行中queryを取消し、アカウント由来cache・sessionを消す。「削除予約を受け付けました」と復帰期限を示す |
| 予約結果未確定         | 完了や未申請を断定せず「結果を確認」から照会する。新しい受付番号で自動再申請しない                                    |
| 猶予中                 | 予約中・期限を表示し、「期限までにGoogleでログインすると削除予約が取り消されます」と案内する                          |
| 再有効化commit確認済み | 同じアカウントへ戻り、予約を取り消したことを通知してデータを取り直す                                                  |
| 期限到来・削除遅延     | 取消・復帰できない。削除待ち/処理中と示し、結果照会・必要時の運営者連絡を案内する                                     |
| 物理削除commit確認済み | 削除完了と表示する。通常データを再表示しない                                                                          |
| 端末内の消去失敗       | サーバーの予約成立/物理削除と端末の問題を区別する。保護画面を隠し、端末内消去の再試行を案内する                       |

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

| 境界                                                                       | 契約                                                                                                                                             |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prepare_account_deletion()`                                               | 有効な本人sessionとusersを確認し、説明・現在のBook分類件数を返す。予約や削除を行わない                                                           |
| `request_account_deletion(request_id, result_secret, explanation_version)` | 直近5分以内の本人sessionを検証し、pending要求・168時間の期限を同じtransactionで確定する。対象user IDは受けない                                   |
| `reactivate_my_account(request_id)`                                        | 本人の新しいログインsession、対象pending要求、DB期限を検証し、cancelledへ変更する。期限後は拒否する                                              |
| `get_my_account_deletion_state()`                                          | 有効な本人sessionから、自分のpending状態・期限・復帰可否だけを返す。通常データへはアクセスさせない                                               |
| `get_account_deletion_result(request_id, result_secret)`                   | sessionなしでも正しい確認キーで、その要求の `pending` / `cancelled` / `completed` と期限だけを照会できる。不一致・記録なしは一律 `not_confirmed` |
| `private.delete_due_accounts()`                                            | Cronの管理roleだけが実行する。期限・再試行時刻が来たpending要求だけを再検査して物理削除する。anon/authenticatedへ公開しない                      |

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

[Supabase Cron](https://supabase.com/docs/guides/cron)からDB関数を1分おきに起動し、1回最大10件の期限・再試行時刻が来たpending候補を処理する。
専用の管理roleだけに実行権限を与える。既存の静的Web配信にサーバー処理や管理キーを追加しない。

1. 候補のaccount lockを取得し、その要求IDをlockして `pending`、`delete_after <= DB時刻`、再試行時刻を再検査する。取消済み・古い要求・未期限の要求はskipする。
2. 本人Auth行と現在の全所属BookをID昇順でlockする。別statementの新しいsnapshotでmembershipを読み直す。
3. Storage所有object・不明な削除依存を検出したら停止し、metadataだけを消して成功にしない。
4. 本人 `auth.users` の1行を削除し、既存FK/triggerにより本人users・pin・membership、無人Bookと全Book-owned dataを削除する。
5. 本人Auth/users/membershipと無人Bookの残存を検査し、同じ要求をcompletedにする。この変更と削除を一緒にcommitした結果だけを削除完了とする。

各候補の削除とcompleted更新はPL/pgSQLの例外blockによるサブtransactionに含める。失敗した候補はAuth削除を含めrollbackする。
その外側でpendingを維持し、有限のエラー分類・回数・次回試行時刻を更新する。再試行間隔は1分から倍増し最大1時間とする。
バッチ全体が中断・timeoutしたら未commitの成功候補・試行情報もrollbackされ、次回の実状態から再試行する。
ジョブが再実行されてもcompleted要求は削除を繰り返さない。永続deleting状態やブラウザの再送queueは不要とする。

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
照会は要求状態・期限しか返さず、identity・件数・明細や通常データの取得権限を与えない。

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
運営者はジョブ未起動・最後の成功時刻・期限超過件数/最古age・エラー分類/回数・次回試行・記録消去遅延を確認する。
試行上限で放置せず、繰り返す失敗やStorage等の設計外依存を運営者が調査する。遅延を削除完了と表示しない。

運営者管理backupは最大7日とし、予約中の状態・期限・取消・完了を復旧時にも再適用する。
復旧元より後の最小の要求状態一覧を稼働系または分離保管先から取得し、通信を閉じた別環境でrestore後に適用してから公開する。
一覧は復旧元以後のcommit済み遷移を漏れなく反映した要求IDごとの最新状態であることを確認する。取消済み要求を先に反映し、現在のpending要求と元の期限を再構成する。
completed対象は記録行を戻すだけで終えず、不変のAuth UUIDに対応する復元済みAuth/usersを同じcascade境界で実際に再削除し、残存を検査する。
通常ジョブはcompletedをskipするため、その再起動だけで再削除済みと扱わない。再登録された別Auth UUIDをemailで同一視して削除しない。
一覧はpending中と終端から30日の範囲で保持する。予約が消えて復帰する、取消済み要求が復活して削除される、削除済みアカウントが再公開されることを防ぐ。
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

## 後続実装の完了条件と検証

実装Taskは[Issue案](account-deletion-implementation-issue.md)と次の観測条件を満たす。実データを使わず、隔離DB・合成ユーザーを使う。

| 観測条件                                                     | 必要な結果                                                                                                            |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| 予約成立・予約途中エラー・応答喪失・同一/別番号の重複        | 予約と利用停止は一括成立する。Auth/データ/所属は未削除。二重予約・期限延長・偽の完了表示をしない                      |
| pending利用者の旧JWT/refresh・別端末・REST/RPC/認証同期      | 通常データのread/writeと再同期を拒否する。本人の状態照会・期限内新規ログイン復帰だけを例外にする                      |
| 期限直前・同時・直後、時差・ブラウザ時計偽装、lock待機       | DB時刻が期限未満の復帰だけ成立する。期限後はジョブ未実行でも復帰不可                                                  |
| 明示Googleログイン・refresh・session復元                     | 同じ本人の申請後の新sessionだけ予約を取り消す。refresh/復元/古いcallbackは取り消さない                                |
| OAuth別identity・callbackエラー・marker期限切れ              | sessionを隔離・破棄し、元sessionを置き換えず、別identityのBurneto user/default Bookを作らない                         |
| 復帰とジョブの競合・取消後の再申請・旧要求の遅延実行         | 有効化と物理削除は同時成立しない。古いジョブが新しい期限の要求を削除しない                                            |
| 期限前ジョブ・期限後の成功                                   | 期限前は何も消さない。期限後はAuth/identity/session/refresh・本人users/pin/membership、無人Bookと全履歴を原子的に消す |
| 他memberが残るBook・最後の2memberの同時削除                  | 他memberと全データを保持し、最終的な無人Bookを残さない。猶予中も他memberは利用できる                                  |
| Storage依存・SQL例外・completed記録失敗・ジョブ中断/二重起動 | 部分削除をrollbackし、pendingを維持する。再試行・遅延確認ができ、成功済み要求を再削除しない                           |
| reload・JWT失効・番号/キー紛失・30日期限・遅延応答           | 匿名照会で状態を確認できる。照合不能は明示し、別アカウントへのcache混入や成功誤認をしない                             |
| 物理削除前の旧JWT/refreshを保存して削除後に再利用            | 通常データ・認証同期・refreshが拒否され、削除済みAuth IDが再作成されない                                              |
| backupに予約前/予約中/取消前/完了前が含まれる復旧            | 最新要求状態を再適用し、意図しない復帰・取消済み要求の削除・削除済みアカウント再公開をしない                          |
| DB/Webの旧新版・ジョブ停止・切り戻し                         | active利用者の既存動作を維持し、pendingの認可を迂回できず、既存予約の処理を継続する                                   |

Webは `pnpm run web:format` 後に、`pnpm run web:lint`、`pnpm run web:format-check`、`pnpm run web:typecheck`、`pnpm run web:test:unit-integration` を並行実行する。
対象storyがbrowser-testなら `pnpm run web:test:storybook` も実行する。
DBは隔離Supabaseで `pnpm exec supabase test db --workdir apps/api`、並行transaction・失敗注入・実Data APIのread/write境界を確認する。
Googleの新session・callback隔離・期限内復帰とCron稼働は、承認されたDevの合成アカウントで照合する。
job件数・実データ規模相当の合成データ・実効timeout・実行時間を測り、1分/10件の処理容量と再試行で滞留を処理できることを公開前に確認する。
ローカルSQL・MSW・HTMLシミュレーションだけでHostedの実動作を検証済みとは扱わない。

## 根拠と参照

- 現在のIntentは[#1884](https://github.com/kosnu/savings/issues/1884)と、7日間の猶予・期限内再ログインでの再有効化・期限後非同期削除を採用したユーザーの明示指示。[#1560](https://github.com/kosnu/savings/issues/1560)は過去の経緯であり方式を拘束しない。
- [既存Auth連携・cascade・RLS](../../apps/api/supabase/migrations/20260621000000_link_users_to_auth_users.sql)、[Book所有への移行](../../apps/api/supabase/migrations/20260508000000_remove_user_ownership_from_book_owned_data.sql)。
- [Transaction Boundaries](../harness/policies/transaction-boundaries.md)、[Temporal Data Policy](../harness/policies/temporal-data.md)、[インフラ構成](../infrastructure.md)、[Supabase Dev検証](../supabase-dev-verification.md)、[Sentry運用](../sentry-monitoring.md)。
- [Burneto Design System](../../DESIGN.md)、[Web Design Rules](../../apps/web/docs/policies/design-rules.md)。
- [Supabase User Management](https://supabase.com/docs/guides/auth/managing-user-data)、[Sessions](https://supabase.com/docs/guides/auth/sessions)、[Database Functions](https://supabase.com/docs/guides/database/functions)、[Cron](https://supabase.com/docs/guides/cron)。Auth削除後も発行済みJWTは期限まで残り得るため、UI logoutだけに依存しない。
- [PostgreSQL lock](https://www.postgresql.org/docs/17/explicit-locking.html)、[isolation](https://www.postgresql.org/docs/17/transaction-iso.html)、[PL/pgSQLのエラー処理](https://www.postgresql.org/docs/17/plpgsql-control-structures.html#PLPGSQL-ERROR-TRAPPING)。公式仕様の確認日: 2026-10-22。
