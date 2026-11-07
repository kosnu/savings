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

[Issue #1884](https://github.com/kosnu/savings/issues/1884) の設計成果。[公開・監視・復旧手順](../account-deletion-operations.md)と併せて適用する。
[HTML解説](account-deletion.html)と[実装Issue案](account-deletion-implementation-issue.md)を併せて参照する。

## 基本方針と時刻

削除予約が成立すると通常利用を停止し、Auth・データ・所属を保持する。
申請から168時間未満の新しい本人Googleログインでのみ予約を取り消して再有効化する。自動refresh・既存sessionの復元では取り消さない。
復帰期限以降は再有効化できず、その期限以降で最初の午前3時（日本時間）から、毎日03:00〜03:59だけ毎分最大10件ずつ物理削除する。

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

## 削除・保持する情報と共有ブック

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
猶予中の他memberの退会で共有Bookも削除対象になり得るため、申請時の件数previewを固定リストや削除許可には使わない。画面では「共有ブックとその記録は、削除時に他のメンバーが残っていれば消えません」と説明する。

## 利用者の確認と画面状態

「設定 → アカウント」（`/settings/account`）で表示名を編集し、登録メールアドレスを確認して削除を予約できる。旧URL `/settings/profile` はアカウント画面へ転送する。日英の開始・ログイン・削除の案内とPrivacyでは認証方法を明示しない。復帰の案内は「同じアカウントでログイン」とする。
導線は `soft/red`、予約の最終確定は `solid/red`、取消は `soft/gray`。
確認dialogは「アカウントの削除を予約しますか？」とし、対象アカウント・削除対象・共有ブックへの影響・二つの時刻・7日以内に同じアカウントでログインすることによる復帰・期限後の復帰不可と削除後の復元不可を短く説明する。UIの用語は「ブック」に統一する。内部項目の列挙、処理件数や保存期間などの運用説明、Privacyリンクはdialogに置かない。保存・運用の詳細はPrivacyと本設計で扱う。
初期focusは取消。Enterや画面表示だけで確定せず、送信前はEscape・閉じる操作で戻れるようにする。ja/enとPrivacyの案内をそろえ、キーボード・スクリーンリーダー・モバイルでも同じ読み順と操作を提供する。

| 状態                            | 表示と操作                                                                                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 説明の読込失敗                  | 確定できない。再取得・戻る操作を提供する                                                                                                                             |
| 対象確認・送信中                | ログイン中の本人が追加ログインなしで対象を確認して明示確定する。送信中は対象変更・確定・取消を無効化し、通信の取消を予約取消と扱わない                               |
| 予約受付を確認                  | 保護画面を隠し、queryを取り消してcacheを消し、自動ログアウトする。申請端末では受付を一度だけ通知し、通常のログアウト後のトップへ戻る。再読込しても通知を繰り返さない |
| 別端末の既存sessionで予約を検知 | 保護画面を隠し、自動ログアウトして通常のトップへ戻る                                                                                                                 |
| 予約結果未確定                  | 申請ページを開いている間は同じ受付を確認する。確認失敗時だけ再試行を案内し、別番号で自動再申請しない                                                                 |
| 端末内のログアウト失敗          | 保護画面を隠したままログアウトの再試行を案内する                                                                                                                     |
| 再有効化済み                    | 予約取消を通知し、同じアカウントのデータを再取得する                                                                                                                 |
| 復帰期限以降                    | 通常ログインでも復帰させない。利用停止を維持し、削除開始予定後にジョブが物理削除する                                                                                 |

再確認は申請中のページで応答を失ったときに使う。ページを閉じたり再読込したりすると追跡は終了する。トップには予約の詳細、結果照会メニューや復帰専用ボタンを設けず、受付番号や確認キーの入力も求めない。

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

| 境界                                                                       | 契約                                                                                                                                                                                                         |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prepare_account_deletion()`                                               | 有効な本人sessionとusersを確認し、説明・現在のBook分類件数を返す。予約や削除を行わない                                                                                                                       |
| `request_account_deletion(request_id, result_secret, explanation_version)` | 現在の有効な本人sessionを検証し、pending要求・168時間の復帰期限を同じtransactionで確定する。追加ログインやsession作成からの経過時間制限は設けない。復帰期限と物理削除の開始予定を返す。対象user IDは受けない |
| `reactivate_my_account(request_id)`                                        | 本人の新しいログインsession、対象pending要求、DB期限を検証し、cancelledへ変更する。期限後は拒否する                                                                                                          |
| `get_my_account_deletion_state()`                                          | 有効な本人sessionから、自分のpending要求の `request_id`・状態・復帰期限・物理削除の開始予定・復帰可否を返す。pendingがなければIDは返さない。通常データへはアクセスさせない                                   |
| `get_account_deletion_result(request_id, result_secret)`                   | sessionなしでも正しい確認キーで、その要求の `pending` / `cancelled` / `completed` と復帰期限・物理削除の開始予定だけを照会できる。不一致・記録なしは一律 `not_confirmed`                                     |
| `private.delete_due_accounts()`                                            | Cronの管理roleだけが実行する。物理削除の開始予定・再試行時刻が来たpending要求を最大10件再検査して削除する。anon/authenticatedへ公開しない                                                                    |

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

予約は現在のJWTの `session_id` と `auth.sessions` の本人・実在・有効期限を照合する。ログイン中の本人の明示確定で受け付け、追加のGoogleログインや5分以内の新sessionを要求しない。
再有効化だけはDB時刻でsession作成から5分以内、かつその要求の `requested_at` より後であることを要求する。
refreshで変わる `iat`、通常sessionの復元、`onAuthStateChange` のイベント名だけでは新しいログインと判定しない。
これは直近のBurnetoログインの確認で、Googleのパスワード再入力を保証するものではない。

ログアウト後のトップにある通常のログイン操作から開始し、同じoriginの固定callback `/auth` へ戻す。同じタブで明示的に開始したログインと戻り先をPKCEで結び付け、開始から5分以内に一回限りの認証コードを交換する。任意のreturn URLを受け付けない。再有効化の認可とsessionの鮮度はDBで検査する。

callbackでは、通常の認証同期の前にSDKでsessionを検証し、対象の本人と状態を照合する。本人のpendingがあるときだけ、本人向け状態照会の `request_id` で `reactivate_my_account(request_id)` を呼ぶ。別端末でも同じ手順で復帰でき、受付番号や確認キーは要らない。期限内の取消を確認してから通常データを読み直す。
有効な通常ログインで別のアカウントを選んだ場合はその本人として扱い、元の予約には触れない。古いcallback・認証エラーで意図しないsessionの置換やuser・default Bookの作成を起こさない。失敗時は当該ログインの一時情報だけを消去し、元sessionと他端末のsessionを維持する。処理済みcallbackの再利用、sessionの初期復元や自動refreshで再有効化RPCを呼ばない。
通常ログインの初回登録・redirectを維持し、別アカウントに以前の予約を表示しない。認証callbackから新規の削除予約は行わない。
期限後のGoogle認証成功を復帰や新規登録に読み替えず、物理削除前なら停止状態の確認だけを許可する。

## 予約・取消・物理削除の原子性と競合

[Transaction Boundaries](../harness/policies/transaction-boundaries.md)に従い、予約・取消・各物理削除をそれぞれ原子的に扱う。
すべて同じAuth UUID由来のaccount単位transaction advisory lockを最初に取得し、対象要求・Auth行・Book行の順で処理する。
ジョブはaccount lockを取得できない候補をskipし、後から再検査する。要求の状態と時刻はlock取得後の別statementで読み直す。

### 削除予約

1. 本人認証後、account lockを取り、同じ受付番号・本人・確認キーhashの要求があればその現在状態を返す。別本人/別キーでの番号再利用は拒否する。
2. Auth実在・users対応・現在の有効な本人session・説明versionを確認する。他のpendingがあれば重複予約せず既存要求ありと返し、本人向け状態照会へ案内する。他要求の確認キーは開示しない。
3. DBでpending要求と168時間の期限を作りcommitする。Auth・membership・登録データは削除しない。このcommitがサーバー上の利用停止時点となる。
4. DBの受付結果を確認してから予約成立を通知する。応答を失った場合は同じページで同一受付番号を照会する。

### 期限内の再有効化

1. account lockと対象要求のlockを取り直し、本人・要求ID・新しいsessionを検証する。
2. DBの現在時刻が期限より前で、同じ要求がpendingのときだけcancelledへ更新しcommitする。元のデータ・所属はそのまま利用可能になる。
3. 同じ取消の再送は同じ取消結果を返す。completedや別要求を有効化しない。期限以上はジョブ未実行でも拒否する。
4. 取消後に再申請したら、新しい受付番号と新しい168時間の期限を作る。古い要求IDのジョブ・取消・再送で新しい要求を変更しない。

### 期限後のジョブ

[Supabase Cron](https://supabase.com/docs/guides/cron)から日本時間03:00〜03:59だけDB関数を1分おきに起動し、`pending` かつ物理削除の開始予定 `purge_after` と次回試行時刻がDB時刻以下の候補を1回最大10件処理する。
候補は開始予定・受付UUIDの順で選ぶ。時間帯終了時の残件・失敗分は翌日の同じ時間帯へ回す。CronはUTCで `* 18 * * *` とし、残件ゼロによる動的な有効化・停止は行わない。
最大600件／日の容量を採用し、規模の増加で不足した時点で再設計する。1件の大量削除や失敗による処理件数の低下は公開前に検証する。専用の管理roleだけに実行権限を与える。

1. 候補のaccount lockを取得し、その要求IDをlockして `pending`、`delete_after <= DB時刻`、算出した `purge_after <= DB時刻`、再試行時刻を再検査する。取消済み・古い要求・復帰期限前・物理削除の開始予定前の要求はskipする。
2. 本人Auth行と現在の全所属BookをID昇順でlockする。別statementの新しいsnapshotでmembershipを読み直す。
3. Storage所有object・不明な削除依存を検出したら停止し、metadataだけを消して成功にしない。
4. 本人 `auth.users` の1行を削除し、既存FK/triggerにより本人users・pin・membership、無人Bookと全Book-owned dataを削除する。
5. 本人Auth/users/membershipと無人Bookの残存を検査し、同じ要求をcompletedにする。この変更と削除を一緒にcommitした結果だけを削除完了とする。

各候補の削除とcompleted更新はPL/pgSQLの例外blockによるサブtransactionに含める。失敗した候補はAuth削除を含めrollbackする。
その外側でpendingを維持し、有限のエラー分類・回数・次回試行時刻を更新する。再試行間隔は1分から倍増し最大1時間とし、次回試行時刻は失敗を確認したDB時刻から設定する。
再試行でも元の `delete_after`・`purge_after` は延長・再設定しない。開始予定と次回試行時刻を満たした03時台のジョブで再試行し、その時間帯を過ぎた分は翌日へ回す。
バッチ全体のtimeoutでは未commitの削除と再試行情報もrollbackする。同じ候補群でtimeoutが続く場合は、運営者が通常ジョブを一時停止し、専用管理roleで該当候補を1要求ずつ別transactionで処理して原因の要求を特定する。単件でもtimeoutしたら、そのtransactionの終了後に別transactionで同じaccount・要求をlockし、なおpendingなら既存の次回試行時刻を調査後に処理できる時刻まで延期する。復帰期限・開始予定・利用停止は維持する。
通常ジョブを再開し、03時台の実行で他の要求を先に処理する。運営者は延期した要求を追跡し、原因解消後は元の要求IDで通常の削除条件を再検査して完了を確認する。
completed要求は再削除しない。

同じBookの最後の2memberの削除はBook lockで直列化する。実行関数は `VOLATILE` / READ COMMITTEDで待機後の新しいsnapshotを使う。
管理者のAuth Admin/直接SQL削除も同じlock規約へ参加させるか、ジョブと並行させない。既存の任意管理操作まで自動で保護済みとは扱わない。
利用者向けRPCのtimeout内で一括削除する案は採らず、ブラウザでは予約だけを確定する。
アプリ情報を先に消してAuth Admin APIを別transactionで呼ぶ方式も、片成功と補償処理を増やすため採らない。
DBからの直接Auth削除は[公式User Management](https://supabase.com/docs/guides/auth/managing-user-data#deleting-users)を根拠に採用し、対象版の権限・cascade・Auth連動を隔離環境で確認してから公開する。

## 結果未確定と照会情報の限界

ブラウザは送信前に受付UUIDとWeb Cryptoの32byte乱数の確認キーを生成し、同じ要求で使い続ける。
受付番号・確認キー・対象Auth UUIDは申請中のページのメモリに限って扱う。旧版が保存した控えは読み取らず、削除可能な場合に破棄する。
確認キーはDBでhashだけを保持し、URL・console・Sentry・問い合わせメールへ出さない。RPCで形式・長さを検査する。
匿名照会はpublishable keyだけの独立requestとし、期限切れの通常JWTを付けない。申請ページを開いている間は、同じ受付情報で結果を確認できる。再読込後は以前の要求を照会・再送しない。手入力や別端末へのキーの持ち出しは案内しない。
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
申請後にページを開き直した場合、既存セッションはサーバーで本人の予約状態を確認する。予約中なら利用を停止する。この確認で以前の受付通知を再表示しない。
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

今回のWeb配信と新規受付はDevに限定する。削除・保守Cronの定義と実行権限の設定手順は環境共通とする。
公開順序はDBの要求記録・停止認可・本人RPC・ジョブ/保守・運用手順、隔離/Dev検証、Web/Privacyとする。
Authのredirect allowlistでは通常ログインが戻る対象originの `/auth` を照合する。任意URLや他環境への復帰は許可しない。
既存RPCの署名は維持し、activeユーザーの旧Webも利用できる。pending利用者を旧Webから迂回できないことを確認する。
停止認可が既存の公開経路すべてに適用され、Cronが稼働するまで新しい予約導線を有効化しない。
切り戻しは新規予約を止める。既存予約の停止・期限内復帰・期限後削除・照会・保持処理は継続し、予約を放置したり一律取り消したりしない。
重大な問題でジョブ停止が必要な場合は利用停止と取消期限を維持し、遅延として運営者が対処する。成功済み削除は復元しない。
本番適用、管理権限/Cron等の外部設定、共有Devへの変更、実アカウント試験は、対象と影響を示した別の実行承認が必要。本書はその操作許可を与えない。

## 検証する境界

隔離DBと合成ユーザーで次を確認する。実装範囲と完了条件は[Issue案](account-deletion-implementation-issue.md)に置く。

- **予約と認可**：途中失敗・応答喪失・番号の重複でも二重予約や期限延長をしない。旧JWT・refresh・別端末・旧Web・REST/RPCから停止を迂回できず、削除済みAuth IDも再作成されない。
- **再有効化とOAuth**：168時間の直前/同時/直後、lock待機、新規ログインとsession復元、別identity・古いcallback・marker紛失/期限切れを照合する。別端末で本人照会から復帰まで通し、再申請後の旧IDは拒否する。別のアカウントを選ぶ通常ログインでは、その本人のデータだけを開き、元の予約が残ることを確認する。失敗したcallbackで元のsessionが置換されず、他端末がログアウトしないことも確認する。
- **時刻と分割処理**：03:00直前/同時/直後と03:59/04:00のCron境界・翌日再開、UTC日付差、端末時計・timezoneの違いでも繰り上げ削除しない。11件の先頭候補で連続してバッチをtimeoutさせる。単件切り分けと延期後に残り10件が進み、原因解消後に先頭の1件も元の開始予定のまま完了することを確認する。
- **削除と共有**：最後の2memberの同時削除、Storage依存、SQL例外、完了記録失敗、ジョブ中断/二重起動を試す。部分削除・無人Bookの残存・共有データの誤削除を防ぐ。
- **結果と復旧**：応答を失ったページでは同じ受付を確認し、再読込後は以前の要求を照会・再送しない。受付通知は申請した本人に一度だけ表示する。保存領域へのアクセス拒否と同じブラウザでのアカウント切替が別人の予約を妨げないことを確かめる。別端末はpending検知で通常トップへ戻る。遅延応答・照合情報紛失・30日の照会期限で成功を誤表示せず、別アカウントへcacheを混ぜない。各状態を含むbackup復旧、新旧DB/Webの混在、切り戻しでも元の要求状態と期限を維持する。
- **Hostedの実動作**：承認されたDevでGoogleの新session・通常callbackでの本人照合・期限内復帰・Cronを確認する。午前3時の集中と実データ規模相当のデータで、03時台の1分/10件・最大600件／日の容量とtimeout・翌日再試行による滞留解消を測る。HTMLやMSWの成功で代替しない。

## 根拠と参照

- [既存Auth連携・cascade・RLS](../../apps/api/supabase/migrations/20260621000000_link_users_to_auth_users.sql)、[Book所有への移行](../../apps/api/supabase/migrations/20260508000000_remove_user_ownership_from_book_owned_data.sql)。
- [Transaction Boundaries](../harness/policies/transaction-boundaries.md)、[Temporal Data Policy](../harness/policies/temporal-data.md)、[インフラ構成](../infrastructure.md)、[Supabase Dev検証](../supabase-dev-verification.md)、[Sentry運用](../sentry-monitoring.md)。
- [Burneto Design System](../../DESIGN.md)、[Web Design Rules](../../apps/web/docs/policies/design-rules.md)。
- [Supabase User Management](https://supabase.com/docs/guides/auth/managing-user-data)、[Sessions](https://supabase.com/docs/guides/auth/sessions)、[Database Functions](https://supabase.com/docs/guides/database/functions)、[Cron](https://supabase.com/docs/guides/cron)。Auth削除後も発行済みJWTは期限まで残り得るため、UI logoutだけに依存しない。
- [PostgreSQL日時・timezone変換](https://www.postgresql.org/docs/17/functions-datetime.html#FUNCTIONS-DATETIME-ZONECONVERT)、[lock](https://www.postgresql.org/docs/17/explicit-locking.html)、[isolation](https://www.postgresql.org/docs/17/transaction-iso.html)、[PL/pgSQLのエラー処理](https://www.postgresql.org/docs/17/plpgsql-control-structures.html#PLPGSQL-ERROR-TRAPPING)。日時・Cronは2026-10-23、その他の公式仕様は2026-10-22に確認。
