-- 対象project・影響・復旧方針の承認後だけ実行する。新規受付は別途有効化する。
begin;
create extension if not exists pg_cron with schema pg_catalog;
-- cron.scheduleの登録者が実行者になる。管理関数は明示的なrole切替後だけ呼ぶ。
grant account_deletion_admin to current_user with inherit false, set true;
-- cron.timezoneがUTC/GMTであることを確認する。日本時間03:00〜03:59だけ起動する。
do $$ begin
  if current_setting('cron.timezone', true) is null or current_setting('cron.timezone') not in ('GMT', 'UTC', 'Etc/UTC') then
    raise exception 'Cron timezone must be UTC.';
  end if;
  if not pg_has_role(current_user, 'account_deletion_admin', 'SET') then
    raise exception 'Cron job owner cannot set account_deletion_admin.';
  end if;
end; $$;
select cron.schedule('burneto-account-deletion', '* 18 * * *',
  'set local role account_deletion_admin; select private.delete_due_accounts();');
select cron.schedule('burneto-account-deletion-retention', '0 18 * * *',
  'set local role account_deletion_admin; select private.clean_account_deletion_results();');
commit;
