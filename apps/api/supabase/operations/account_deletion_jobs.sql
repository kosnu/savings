-- 対象project・影響・復旧方針の承認後だけ実行する。新規受付は別途有効化する。
begin;
create extension if not exists pg_cron with schema pg_catalog;
-- cron.timezoneがUTC/GMTであることを確認する。日本時間03:00〜03:59だけ起動する。
do $$ begin
  if current_setting('cron.timezone', true) is null or current_setting('cron.timezone') not in ('GMT', 'UTC', 'Etc/UTC') then
    raise exception 'Cron timezone must be UTC.';
  end if;
end; $$;
select cron.schedule('burneto-account-deletion', '* 18 * * *',
  'set local role account_deletion_admin; select private.delete_due_accounts();');
select cron.schedule('burneto-account-deletion-retention', '0 18 * * *',
  'set local role account_deletion_admin; select private.clean_account_deletion_results();');
commit;
