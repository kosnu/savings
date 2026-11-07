begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

-- 夜間windowだけ時計を固定する。実際の関数本体を使い、本番へclock入力を加えない。
-- requested_atや期限判定・本人sessionのclockは実時刻のまま検証する。
do $$ begin
  execute replace(pg_get_functiondef('private.delete_due_accounts()'::regprocedure),
    'clock_timestamp()', '(current_setting(''test.deletion_time''))::timestamptz');
end; $$;
select set_config('test.deletion_time','2026-11-06 18:30:00+00',true);

-- 本番時刻関数を書き換えず、合成Auth/sessionと期限の両側を用意する。
insert into auth.users (id, email) values
  ('20870000-0000-0000-0000-000000000001', 'deletion-one@example.com'),
  ('20870000-0000-0000-0000-000000000002', 'deletion-two@example.com');
insert into auth.sessions (id, user_id, created_at, updated_at) values
  ('20870000-0000-0000-0001-000000000001', '20870000-0000-0000-0000-000000000001', clock_timestamp() - interval '1 day', clock_timestamp()),
  ('20870000-0000-0000-0001-000000000002', '20870000-0000-0000-0000-000000000002', clock_timestamp() - interval '1 minute', clock_timestamp());
insert into public.users (auth_user_id, email, name) values
  ('20870000-0000-0000-0000-000000000001', 'deletion-one@example.com', 'one'),
  ('20870000-0000-0000-0000-000000000002', 'deletion-two@example.com', 'two');
create temp table deletion_fixture as
  select u.auth_user_id, u.id user_id, m.book_id from public.users u
    join public.book_members m on m.user_id = u.id where u.email like 'deletion-%@example.com';
insert into public.book_members (book_id, user_id, is_default)
  select a.book_id, b.user_id, false from deletion_fixture a cross join deletion_fixture b
  where a.auth_user_id = '20870000-0000-0000-0000-000000000001'
    and b.auth_user_id = '20870000-0000-0000-0000-000000000002';
insert into public.payments (book_id, date, amount)
  select book_id, '2026-11-01', 100 from deletion_fixture;

select is(private.account_deletion_purge_after('2026-10-29 17:59:59+00'), '2026-10-29 18:00:00+00'::timestamptz, '03時直前は直後の03時');
select is(private.account_deletion_purge_after('2026-10-29 18:00:00+00'), '2026-10-29 18:00:00+00'::timestamptz, '03時同時は当日');
select is(private.account_deletion_purge_after('2026-10-29 18:00:00.000001+00'), '2026-10-30 18:00:00+00'::timestamptz, '03時直後は翌日');
set local timezone = 'America/New_York';
select is(private.account_deletion_purge_after('2026-10-29 18:00:01+00'), '2026-10-30 18:00:00+00'::timestamptz, 'DB timezoneで開始予定を変えない');
set local timezone = 'UTC';

select ok(not has_table_privilege('authenticated', 'private.account_deletion_requests', 'SELECT'), '本人にも要求tableを直接公開しない');
select ok(not has_table_privilege('anon', 'private.account_deletion_requests', 'SELECT'), '匿名に要求tableを公開しない');
select ok(not has_function_privilege('authenticated', 'private.delete_due_accounts()', 'EXECUTE'), '本人roleから削除jobを呼べない');
select ok(not has_function_privilege('anon', 'private.reactivate_my_account(uuid)', 'EXECUTE'), '匿名キーは取消の権限にならない');
select ok(not has_function_privilege('service_role', 'private.delete_due_accounts()', 'EXECUTE'), 'jobは専用管理roleに限定する');
select ok(has_function_privilege('account_deletion_admin', 'private.delete_due_accounts()', 'EXECUTE'), '専用管理roleでjobを実行できる');
select ok(not p.prosecdef, '公開RPCはinvoker') from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('prepare_account_deletion','request_account_deletion','get_my_account_deletion_state','reactivate_my_account','get_account_deletion_result');

select set_config('request.jwt.claims', '{"sub":"20870000-0000-0000-0000-000000000001","email":"deletion-one@example.com","session_id":"20870000-0000-0000-0001-000000000099"}', true);
set local role authenticated;
select throws_ok($$select public.request_account_deletion('20870000-0000-0000-0002-000000000001',repeat('a',64),'2026-11-06')$$,'42501','Valid account session required.','存在しないsessionからの予約を拒否する');
select set_config('request.jwt.claims', '{"sub":"20870000-0000-0000-0000-000000000001","email":"deletion-one@example.com","session_id":"20870000-0000-0000-0001-000000000002"}', true);
select throws_ok($$select public.request_account_deletion('20870000-0000-0000-0002-000000000001',repeat('a',64),'2026-11-06')$$,'42501','Valid account session required.','別本人のsessionからの予約を拒否する');
reset role;
select set_config('request.jwt.claims', '{"sub":"20870000-0000-0000-0000-000000000001","email":"deletion-one@example.com","session_id":"20870000-0000-0000-0001-000000000001"}', true);
set local role authenticated;
select is(public.prepare_account_deletion() ->> 'shared_book_count', '1', 'previewは共有Bookを分類する');
select is(public.prepare_account_deletion() ->> 'accepting_requests', 'false', '公開確認前は受付停止');
select ok(not(public.prepare_account_deletion() ? 'session_fresh'),'予約previewは追加ログインの鮮度条件を返さない');
select throws_ok($$select public.request_account_deletion('20870000-0000-0000-0002-000000000001', repeat('a',64), '2026-11-06')$$, '55000', 'Account deletion requests are unavailable.', '受付停止中はDBも拒否する');
reset role;
update private.account_deletion_control set accepting_requests = true;
set local role authenticated;
select throws_ok($$select public.request_account_deletion('20870000-0000-0000-0002-000000000001', 'short', '2026-11-06')$$, '22023', 'Invalid deletion request.', '短いキーを拒否する');
select throws_ok($$select public.request_account_deletion('20870000-0000-0000-0002-000000000001', repeat('a',64), 'old')$$, '22023', 'Refresh the deletion explanation.', '説明version不一致を拒否する');
select is(public.request_account_deletion('20870000-0000-0000-0002-000000000001', repeat('a',64), '2026-11-06')->>'status', 'pending', '1日前に作成された有効な本人sessionで追加認証なしに予約できる');
select is(public.request_account_deletion('20870000-0000-0000-0002-000000000001', repeat('a',64), '2026-11-06')->>'status', 'pending', '応答喪失後も同じIDとキーで照会・再送できる');
select throws_ok($$select public.request_account_deletion('20870000-0000-0000-0002-000000000001', repeat('b',64), '2026-11-06')$$, '22023', 'Invalid deletion request.', '同じIDを別キーで再利用できない');
select throws_ok($$select public.request_account_deletion('20870000-0000-0000-0002-000000000002', repeat('b',64), '2026-11-06')$$, '23505', 'An account deletion is already pending.', '別IDの並行再申請を拒否する');
select is(public.get_my_account_deletion_state()->>'request_id', '20870000-0000-0000-0002-000000000001', '端末キーがなくても本人照会で要求IDを得る');
select is((select count(*) from public.users), 0::bigint, '予約以後の旧JWTによるプロフィール参照を拒否する');
select throws_ok($$select public.get_authenticated_user_id()$$, '42501', 'Account is unavailable.', '旧特権RPCの共通入口でも停止を強制する');
select throws_ok($$select public.ensure_authenticated_user('recreated')$$, '42501', 'Account is unavailable.', 'pending中にuserやdefault Bookを再作成しない');
select throws_ok($$select public.create_monthly_budget('2032-01-01', 1)$$, '42501', 'Account is unavailable.', 'SECURITY DEFINERな予算RPCも拒否する');
select throws_ok($$select public.reactivate_my_account('20870000-0000-0000-0002-000000000001')$$, '42501', 'Fresh Google sign-in required.', '予約可能な古いsessionでも復帰には新しいログインが必要');
reset role;
select is((select delete_after - requested_at from private.account_deletion_requests where request_id='20870000-0000-0000-0002-000000000001'), interval '168 hours', '168時間をDBで固定する');
select is((select result_secret_hash from private.account_deletion_requests where request_id='20870000-0000-0000-0002-000000000001'), extensions.digest(repeat('a',64),'sha256'), '確認キーはhashだけを保存する');
select is((select count(*) from auth.users where id='20870000-0000-0000-0000-000000000001'), 1::bigint, '猶予中のAuthを保持する');
select is((select count(*) from public.payments where book_id in (select book_id from deletion_fixture)), 2::bigint, '猶予中の登録データを保持する');
select is(private.delete_due_accounts(), 0, '期限前の物理削除をしない');
set local role anon;
select is(public.get_account_deletion_result('20870000-0000-0000-0002-000000000001',repeat('a',64))->>'status','pending','匿名キーで結果だけを照会できる');
select is(public.get_account_deletion_result('20870000-0000-0000-0002-000000000001',repeat('b',64)), '{"status":"not_confirmed"}'::jsonb,'不一致を未申請と断定しない');
select is(public.get_account_deletion_result('20870000-0000-0000-0002-000000000099',repeat('a',64)), '{"status":"not_confirmed"}'::jsonb,'記録なしも同じ応答');
select is((select count(*) from jsonb_object_keys(public.get_account_deletion_result('20870000-0000-0000-0002-000000000001',repeat('a',64)))),3::bigint,'匿名結果は状態と二つの時刻だけ');
reset role;

select set_config('request.jwt.claims', '{"sub":"20870000-0000-0000-0000-000000000002","email":"deletion-two@example.com","session_id":"20870000-0000-0000-0001-000000000002"}', true);
set local role authenticated;
select is((select count(*) from public.payments),2::bigint,'他memberは共有Bookを引き続き利用できる');
select throws_ok($$select public.request_account_deletion('20870000-0000-0000-0002-000000000001',repeat('a',64),'2026-11-06')$$,'22023','Invalid deletion request.','別本人は同じ受付番号を使えない');
select throws_ok($$select public.reactivate_my_account('20870000-0000-0000-0002-000000000001')$$,'42501','Account deletion cannot be cancelled.','別本人は取消できない');
reset role;

insert into auth.sessions (id,user_id,created_at,updated_at) values
  ('20870000-0000-0000-0001-000000000003','20870000-0000-0000-0000-000000000001',clock_timestamp(),clock_timestamp());
select set_config('request.jwt.claims', '{"sub":"20870000-0000-0000-0000-000000000001","email":"deletion-one@example.com","session_id":"20870000-0000-0000-0001-000000000003"}', true);
set local role authenticated;
select is(public.reactivate_my_account('20870000-0000-0000-0002-000000000001')->>'status','cancelled','新sessionで取消し復帰する');
select is(public.reactivate_my_account('20870000-0000-0000-0002-000000000001')->>'status','cancelled','取消の再送は同じ結果');
select is(public.get_my_account_deletion_state(),'{"status":"active"}'::jsonb,'復帰後は過去要求IDを返さない');
select is((select count(*) from public.payments),1::bigint,'復帰後に元の家計簿が利用できる');
select is(public.request_account_deletion('20870000-0000-0000-0002-000000000002',repeat('b',64),'2026-11-06')->>'status','pending','取消後に新規予約できる');
select throws_ok($$select public.reactivate_my_account('20870000-0000-0000-0002-000000000002')$$,'42501','New Google sign-in required.','5分以内でも申請前に作成されたsessionでは復帰しない');
select throws_ok($$select public.reactivate_my_account('20870000-0000-0000-0002-000000000001')$$,'42501','A different account deletion is pending.','古い取消IDで新しい予約を操作できない');
reset role;
select ok((select requested_at from private.account_deletion_requests where request_id='20870000-0000-0000-0002-000000000002') > (select requested_at from private.account_deletion_requests where request_id='20870000-0000-0000-0002-000000000001'),'再申請では新しい168時間を開始する');

-- deadline同時以後は開始予定前であっても復帰不可。
with t as (select clock_timestamp() as checked_at) update private.account_deletion_requests
  set requested_at=t.checked_at-interval '168 hours',delete_after=t.checked_at from t
  where request_id='20870000-0000-0000-0002-000000000002';
set local role authenticated;
select throws_ok($$select public.reactivate_my_account('20870000-0000-0000-0002-000000000002')$$,'42501','Account reactivation deadline has passed.','168時間同時以後の復帰は拒否する');
reset role;

-- 期限後の共有Book削除と完了記録を同一transactionに含める。
with t as (select clock_timestamp()-interval '2 days' as checked_at) update private.account_deletion_requests
  set requested_at=t.checked_at-interval '168 hours',delete_after=t.checked_at from t
  where request_id='20870000-0000-0000-0002-000000000002';
create function pg_temp.fail_deletion_completion() returns trigger language plpgsql as $$
begin if new.status='completed' then raise exception 'synthetic completion failure'; end if; return new; end; $$;
create trigger synthetic_completion_failure before update on private.account_deletion_requests
  for each row execute function pg_temp.fail_deletion_completion();
select is(private.delete_due_accounts(),0,'完了記録失敗は削除成功にしない');
select is((select count(*) from auth.users where id='20870000-0000-0000-0000-000000000001'),1::bigint,'完了記録失敗でAuth削除もrollbackする');
select is((select status from private.account_deletion_requests where request_id='20870000-0000-0000-0002-000000000002'),'pending','失敗要求はpendingを維持する');
select is((select retry_count from private.account_deletion_requests where request_id='20870000-0000-0000-0002-000000000002'),1,'失敗回数を更新する');
select ok((select next_attempt_at > clock_timestamp() + interval '55 seconds' from private.account_deletion_requests where request_id='20870000-0000-0000-0002-000000000002'),'失敗確認時刻から1分延期する');
drop trigger synthetic_completion_failure on private.account_deletion_requests;
select is(private.delete_due_accounts(),0,'再試行時刻前は処理しない');
update private.account_deletion_requests set next_attempt_at=clock_timestamp() where request_id='20870000-0000-0000-0002-000000000002';
select is(private.delete_due_accounts(),1,'管理者の単件確認で原因解消後に完了する');
select is((select status from private.account_deletion_requests where request_id='20870000-0000-0000-0002-000000000002'),'completed','削除commitと完了記録が一致する');
select is((select count(*) from auth.users where id='20870000-0000-0000-0000-000000000001'),0::bigint,'Authが物理削除される');
select is((select count(*) from public.users where auth_user_id='20870000-0000-0000-0000-000000000001'),0::bigint,'プロフィールがcascade削除される');
select is((select count(*) from public.payments where book_id in (select book_id from deletion_fixture)),2::bigint,'他memberが残るBookの支払いは保持する');
select is(private.delete_due_accounts(),0,'completed要求を再削除しない');
set local role authenticated;
select throws_ok($$select public.ensure_authenticated_user('resurrected')$$,'42501','Account is unavailable.','削除後の旧JWTからuserを再作成できない');
reset role;

-- 11件以上、単件失敗、未知の依存を残して成功扱いしない。
insert into auth.users (id,email)
  select ('20871100-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'batch-'||i||'@example.com' from generate_series(1,11) i;
insert into public.users (auth_user_id,email,name)
  select id,email,'batch' from auth.users where email like 'batch-%@example.com';
insert into private.account_deletion_requests (request_id,auth_user_id,result_secret_hash,requested_at,delete_after,explanation_version,next_attempt_at)
  select id,id,extensions.digest(repeat('c',64),'sha256'),'2026-01-01 00:00+00','2026-01-08 00:00+00','2026-11-06','2026-01-08 00:00+00'
  from auth.users where email like 'batch-%@example.com';
-- 未使用Storageに依存が追加された場合、所有metadataを見つけたら削除を中止する。
create temp table account_deletion_storage_objects (owner_id text, owner uuid);
create temp table deletion_original_purge as select pg_get_functiondef('private.purge_account(uuid)'::regprocedure) definition;
do $$ begin execute replace((select definition from deletion_original_purge),'storage.objects','pg_temp.account_deletion_storage_objects');end;$$;
insert into account_deletion_storage_objects (owner_id) values ('20871100-0000-0000-0000-000000000001');
select is(private.delete_account_request('20871100-0000-0000-0000-000000000001'),false,'Storage所有metadataがあれば停止する');
select is((select last_error from private.account_deletion_requests where request_id='20871100-0000-0000-0000-000000000001'),'storage_dependency','Storage依存を分類する');
select is((select count(*) from auth.users where id='20871100-0000-0000-0000-000000000001'),1::bigint,'Storage依存時はAuthを削除しない');
do $$ begin execute (select definition from deletion_original_purge);end;$$;
update private.account_deletion_requests set next_attempt_at=clock_timestamp() where request_id='20871100-0000-0000-0000-000000000001';
create table public.synthetic_unknown_dependency (owner uuid references auth.users on delete cascade);
select is(private.delete_account_request('20871100-0000-0000-0000-000000000001'),false,'未知のcascade依存があれば停止する');
select is((select last_error from private.account_deletion_requests where request_id='20871100-0000-0000-0000-000000000001'),'unknown_dependency','有限のエラー分類だけを保存する');
drop table public.synthetic_unknown_dependency;
select private.defer_account_deletion('20871100-0000-0000-0000-000000000001',clock_timestamp()+interval '1 hour');
select is(private.delete_due_accounts(),10,'先頭の延期要求を飛ばして残り10件を処理する');
select is((select count(*) from private.account_deletion_requests where auth_user_id::text like '20871100-%' and status='pending'),1::bigint,'延期した1件はpendingのまま残る');
select is((select count(*) from public.users where email like 'batch-%@example.com'),1::bigint,'完了した10件のプロフィールだけ消える');
select is((select count(*) from public.books where name='Default Book'),3::bigint,'無人Bookは削除し共有Bookと延期対象は保持する');
update private.account_deletion_requests set next_attempt_at=clock_timestamp() where request_id='20871100-0000-0000-0000-000000000001';
select is(private.delete_due_accounts(),1,'延期分も元の期限のまま完了する');

-- 終端から30日ちょうど以後は照会不可。pendingは経過日数で消さない。
update private.account_deletion_requests set requested_at='2026-01-01 00:00+00',delete_after='2026-01-08 00:00+00',finished_at=clock_timestamp()-interval '720 hours'
  where request_id='20870000-0000-0000-0002-000000000001';
set local role anon;
select is(public.get_account_deletion_result('20870000-0000-0000-0002-000000000001',repeat('a',64)),'{"status":"not_confirmed"}'::jsonb,'取消30日以後は保守job前でも照会不可');
select is(public.get_account_deletion_result('20870000-0000-0000-0002-000000000002',repeat('b',64))->>'status','completed','30日以内の完了は照会できる');
reset role;
select is(private.clean_account_deletion_results(),1,'30日経過した終端記録だけ物理消去する');
-- 復旧時はcompletedの記録だけで済ませず、復元された実データを再削除する。
insert into auth.users (id,email) values ('20870000-0000-0000-0000-000000000001','restored-one@example.com');
insert into public.users (auth_user_id,email,name) values ('20870000-0000-0000-0000-000000000001','restored-one@example.com','restored');
select lives_ok($$select private.restore_account_deletion_requests((select jsonb_agg(to_jsonb(r)) from private.account_deletion_requests r where request_id='20870000-0000-0000-0002-000000000002'))$$,'completed状態の復元は同じAuth UUIDを再削除する');
select is((select count(*) from auth.users where id='20870000-0000-0000-0000-000000000001'),0::bigint,'completed対象の復元済みAuthを残さない');
select is((select count(*) from public.users where auth_user_id='20870000-0000-0000-0000-000000000001'),0::bigint,'completed対象の復元済みprofileを残さない');
select is((select accepting_requests from private.account_deletion_control),false,'復旧時に新規予約を再開しない');

-- backup中の旧pendingを取消してから、同じ本人の新pendingを復元する。
with t as (select clock_timestamp()-interval '1 day' requested)
insert into private.account_deletion_requests (request_id,auth_user_id,result_secret_hash,requested_at,delete_after,explanation_version,next_attempt_at)
select '20870000-0000-0000-0002-000000000010','20870000-0000-0000-0000-000000000002',extensions.digest(repeat('d',64),'sha256'),requested,requested+interval '168 hours','2026-11-06',requested from t;
create temp table restore_states as select to_jsonb(r)||jsonb_build_object('status','cancelled','finished_at',clock_timestamp()) state from private.account_deletion_requests r where request_id='20870000-0000-0000-0002-000000000010';
insert into restore_states select (state||jsonb_build_object('request_id','20870000-0000-0000-0002-000000000011','status','pending','finished_at',null,'requested_at',clock_timestamp(),'delete_after',clock_timestamp()+interval '168 hours')) from restore_states;
-- 独立したclock_timestamp呼出しによる微差を排除し、保存契約の168時間を使う。
update restore_states set state=jsonb_set(state,'{delete_after}',to_jsonb((state->>'requested_at')::timestamptz+interval '168 hours'));
select lives_ok($$select private.restore_account_deletion_requests((select jsonb_agg(state order by state->>'request_id' desc) from restore_states))$$,'入力順に依存せず取消を先に再適用する');
select is((select status from private.account_deletion_requests where request_id='20870000-0000-0000-0002-000000000010'),'cancelled','旧pendingは取消状態になる');
select is((select delete_after from private.account_deletion_requests where request_id='20870000-0000-0000-0002-000000000011'),(select (state->>'delete_after')::timestamptz from restore_states where state->>'status'='pending'),'復旧時刻から期限を延長しない');
select throws_ok($$select private.restore_account_deletion_requests((select jsonb_agg(state||jsonb_build_object('auth_user_id','20870000-0000-0000-0000-000000000001')) from restore_states))$$,'P0001','Restore request state conflicts with stored identity or transition.','要求の本人を別UUIDへ差し替えられない');
select throws_ok($$select private.restore_account_deletion_requests((select jsonb_agg(state||jsonb_build_object('status','pending','finished_at',null)) from restore_states where state->>'status'='cancelled'))$$,'P0001','Restore request state conflicts with stored identity or transition.','取消済みの要求をpendingへ巻き戻せない');
select throws_ok($$select private.restore_account_deletion_requests((select jsonb_agg(state)||jsonb_agg(state) from restore_states))$$,'P0001','Duplicate request states.','同じ要求の複数状態を受け付けない');
select throws_ok($$select private.restore_account_deletion_requests('{}')$$,'P0001','Verified request state array required.','最新状態一覧以外を受け付けない');
select throws_ok($$select private.restore_account_deletion_requests((select jsonb_agg(state||jsonb_build_object('request_id','20870000-0000-0000-0002-000000000012','auth_user_id','20870000-0000-0000-0000-000000000099')) from restore_states where state->>'status'='pending'))$$,'P0001','Pending account data is missing from restored backup.','pending本人のAuthが欠けたbackupを拒否する');
select is((select count(*) from private.account_deletion_requests where request_id='20870000-0000-0000-0002-000000000012'),0::bigint,'復旧途中の失敗は要求再適用をrollbackする');
-- Cronの遅延tick、03:59→04:00の候補間境界、翌日再開を実削除で照合する。
insert into auth.users (id,email)
  select ('20873000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'window-'||i||'@example.com' from generate_series(1,3) i;
insert into public.users (auth_user_id,email,name) select id,email,'window' from auth.users where email like 'window-%@example.com';
insert into private.account_deletion_requests (request_id,auth_user_id,result_secret_hash,requested_at,delete_after,explanation_version,next_attempt_at)
  select id,id,extensions.digest(repeat('e',64),'sha256'),'2026-01-01','2026-01-08','2026-11-06','2026-01-08' from auth.users where email like 'window-%@example.com';
select set_config('test.deletion_time','2026-11-06 17:59:59+00',true);
select is(private.delete_due_accounts(),0,'02:59:59には開始しない');
select set_config('test.deletion_time','2026-11-06 18:59:59+00',true);
create function pg_temp.cross_deletion_window() returns trigger language plpgsql as $$
begin perform set_config('test.deletion_time','2026-11-06 19:00:00+00',true); return new; end; $$;
create trigger synthetic_window_end after update on private.account_deletion_requests
  for each row when (new.status='completed') execute function pg_temp.cross_deletion_window();
select is(private.delete_due_accounts(),1,'03:59開始分は完了し、04:00以後の次候補は開始しない');
drop trigger synthetic_window_end on private.account_deletion_requests;
select is(private.delete_due_accounts(),0,'04:00の遅延tickでは削除しない');
select is((select count(*) from private.account_deletion_requests where auth_user_id::text like '20873000-%' and status='pending'),2::bigint,'時間帯終了時の残件はpendingで保持する');
select set_config('test.deletion_time','2026-11-07 18:00:00+00',true);
select is(private.delete_due_accounts(),2,'翌日03:00に残件を再開する');
select * from finish();
rollback;
