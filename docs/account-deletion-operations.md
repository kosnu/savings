---
title: アカウント削除の公開・監視・復旧手順
doc_type: runbook
status: accepted
area: infrastructure
applies_to:
  - apps/api/supabase
  - apps/web/src/features/profile/deleteAccount
topics:
  - account-deletion
  - cron
  - backup
when_to_read:
  - アカウント削除を公開・停止するとき
  - 削除の滞留を調査するとき
  - バックアップから復旧するとき
---

# アカウント削除の運用

[設計](design/account-deletion.md)の状態・期限・認可を維持して運用する。新規受付はmigration直後には停止している。DBを戻したりpendingを取り消したりする切り戻しは行わない。

## 公開前の確認と順序

共有Dev・本番のDB適用、Auth設定、Cron、実アカウント試験は対象project・使用アカウント・削除範囲・停止/復旧方法を提示して承認を得る。以下のSQLは承認済み対象へ管理接続して実行する手順であり、公開承認そのものではない。

1. 対象projectを照合し、最新migrationを適用する。`private`をData API公開schemaへ追加しない。通常クライアントへ管理roleやtable権限を与えない。
2. Auth redirect allowlistへ対象originの `/auth/account-action` を追加し、既存 `/auth` を維持する。他環境や任意URLを追加しない。
3. backup保持を最大7日に設定し、要求状態一覧のアクセス制限・30日保持・復旧手順を確認する。復旧元以後のcommit済み状態を欠けなく得られない運用では受付を有効化しない。
4. [Cron設定SQL](../apps/api/supabase/operations/account_deletion_jobs.sql)を適用する。`cron.timezone` はUTC/GMT、削除scheduleは `* 18 * * *`、保守は `0 18 * * *`。日本時間03:00〜03:59に毎分最大10件、最大600件/日を採用する。残件ゼロで動的停止しない。処理中の1件は完了し得るが、04時以降に新しい候補を処理しない。残件は翌日へ回す。
5. 承認されたDevで、Google新sessionの `session_id`・作成時刻、別identity/marker期限切れ時の元sessionと他端末refresh維持、初回callback隔離、別端末復帰、旧JWTのREST/RPC拒否を実測する。別identityでアプリuser/default Bookが作られないことも確認する。
6. 実環境の公開schema/view/GraphQL/Realtime/Storage経路と停止認可を照合する。Cronの03時台起動・04時境界・翌日再開・保守を確認し、実規模相当の合成データで10件の処理時間・timeout・滞留解消を測る。600件/日を超える需要が見込まれた時点で再設計する。
7. Webと日英Privacyを配信する。旧Webのactive利用が維持され、pendingは旧Webでも利用できないことを確認してから、新規受付を有効化する。

```sql
update private.account_deletion_control set accepting_requests = true where singleton;
```

SQL単体、MSW、HTMLの成功はHosted AuthやCronの実測の代替にしない。公開条件が欠ける場合は新規受付を停止したままにする。

## 日常監視

管理者だけが次を確認する。受付番号・Auth UUID・確認キー・tokenを一般ログ、Sentry、問い合わせメールへ出さない。匿名照会が `not_confirmed` の場合も成功/未申請とは断定しない。

```sql
select jobname, schedule, active, username
from cron.job where jobname like 'burneto-account-deletion%';

select j.jobname, d.status, d.start_time, d.end_time
from cron.job_run_details d join cron.job j using (jobid)
where j.jobname like 'burneto-account-deletion%'
order by d.start_time desc limit 20;

select count(*) as due_count,
       min(private.account_deletion_purge_after(delete_after)) as oldest_start,
       max(clock_timestamp() - private.account_deletion_purge_after(delete_after)) as oldest_age
from private.account_deletion_requests
where status = 'pending'
  and private.account_deletion_purge_after(delete_after) <= clock_timestamp();

select last_error, count(*), max(retry_count), min(next_attempt_at)
from private.account_deletion_requests where status = 'pending'
group by last_error;

select count(*) as expired_terminal_records
from private.account_deletion_requests
where status <> 'pending' and finished_at <= clock_timestamp() - interval '720 hours';
```

直近の03時台に成功がない、期限後の残件が増え続ける、同じ失敗が継続する、終端記録の物理消去が遅れる場合は調査する。復帰締切から最初の03:00までの予定待機と、03時台終了後の翌日待機をジョブ停止と混同しない。pendingは失敗回数を理由に消去・復帰させない。

## timeout・失敗要求の切り分け

通常のSQL例外は要求単位で削除をrollbackし、pendingを維持して1分〜1時間で再試行する。03時台終了後は翌日へ回す。バッチ全体のtimeoutでは再試行情報もrollbackする。

1. 連続timeout時は新規受付と通常ジョブを一時停止する。状態照会と期限内復帰は維持する。
2. 実行中transactionの終了を確認する。管理接続で開始予定と受付番号順の候補を確認し、各候補を**別transaction**で `private.delete_account_request(target_uuid)` に渡す。`SET LOCAL ROLE account_deletion_admin` と、対象環境で測った有限の `statement_timeout` を設定する。受付UUIDは管理接続のbind値とし、公開ログへ貼らない。
3. 単件timeoutなら必ずrollback/接続終了後、**別transaction**で `private.defer_account_deletion(target_uuid, retry_timestamp)` を実行する。調査後に処理できる未来時刻を明示し、元の期限・開始予定・停止状態は変更しない。
4. 他の要求を進められることを確認し、通常ジョブを再開する。原因を解消した要求も延期先の03時台で完了するまで確認する。手動単件処理はCron時間帯の制約外で物理削除できるため、対象を限定した承認範囲でだけ使用する。

`storage_dependency` ならStorage APIでの実体消去を別途設計・承認する。metadata行だけ消して完了扱いしない。`unknown_dependency` は追加FK/trigger、`auth_missing` は正本との不整合、`integrity` は残存データを調査する。原因調査のために通常利用を再許可しない。

```sql
update private.account_deletion_control set accepting_requests = false where singleton;
select cron.alter_job(jobid, active := false)
from cron.job where jobname = 'burneto-account-deletion';
-- 原因要求の延期と他要求の進行を確認してから再開する。
select cron.alter_job(jobid, active := true)
from cron.job where jobname = 'burneto-account-deletion';
```

## バックアップ復旧

要求状態一覧は `private.account_deletion_requests` の全列（確認キーはhashのみ）を要求ID単位の最新commit状態として保持する。pendingと終端後30日以内が対象。取得・保管・搬送は管理者限定の暗号化された経路で行い、生データをIssue、PR、Sentryへ添付しない。

1. アプリとData APIへの外部アクセス、Auth入口、Cronを止める。最大7日以内のbackupを通信を閉じた環境へrestoreする。
2. 復旧元より後の取消・完了・再申請を欠けなく反映した一覧を、稼働系または分離保管先から得る。最終commit点と一覧の完全性を確認できなければ公開を再開しない。復旧先に残る古いpendingも更新対象に含める。
3. 管理接続でJSON配列をbindし `private.restore_account_deletion_requests(latest_jsonb)` を実行する。関数は取消・完了を先に反映し、現在のpendingを再構成する。元のAuth UUID・申請時刻・168時間期限を保持し、completedの復元済みAuth/関連データを実際に再削除する。記録行の更新だけで完了扱いしない。
4. 原子性、pendingの利用停止、cancelledの同じデータへの復帰、completedのAuth/users/membership不在と共有Book保持を管理接続で照合する。再登録した別Auth UUIDをemailで同一視しない。
5. 元の期限から算出した開始予定、次回試行、Cron時刻、保守設定を確認する。必要な検証後に外部アクセスとCronを戻し、公開条件が揃ってから新規受付を再開する。

## 切り戻し

新規受付をfalseにし、既存の停止認可・本人照会・期限内復帰・期限後削除・匿名照会・30日保守は継続する。DBを過去schemaへ戻さず、全pendingの取消や期限延長を行わない。ジョブ停止が必要なら遅延として上記手順で扱う。物理削除がcommitしたデータは利用者向けに復元しない。
