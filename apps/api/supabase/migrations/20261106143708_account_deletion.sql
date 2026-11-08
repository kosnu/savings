-- 要求の正本はData APIへ公開しない。Auth削除後も照会できるようFKを付けない。
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to anon, authenticated, service_role;

create table private.account_deletion_requests (
  request_id uuid primary key,
  auth_user_id uuid not null,
  status text not null default 'pending' check (status in ('pending', 'cancelled', 'completed')),
  result_secret_hash bytea not null check (octet_length(result_secret_hash) = 32),
  requested_at timestamptz not null,
  delete_after timestamptz not null,
  explanation_version text not null check (explanation_version = '2026-11-06'),
  finished_at timestamptz,
  retry_count integer not null default 0 check (retry_count >= 0),
  next_attempt_at timestamptz not null,
  last_error text check (last_error in ('storage_dependency', 'unknown_dependency', 'auth_missing', 'integrity', 'lock_timeout', 'database_error')),
  constraint account_deletion_duration check (delete_after = requested_at + interval '168 hours'),
  constraint account_deletion_terminal check (
    (status = 'pending' and finished_at is null) or
    (status <> 'pending' and finished_at is not null and finished_at >= requested_at)
  )
);
alter table private.account_deletion_requests enable row level security;
revoke all on private.account_deletion_requests from public, anon, authenticated;
create unique index account_deletion_one_pending
  on private.account_deletion_requests (auth_user_id) where status = 'pending';
create index account_deletion_retention
  on private.account_deletion_requests (finished_at) where status <> 'pending';

-- 公開前確認と切り戻しで新規受付だけを止める。既存要求の処理には使わない。
create table private.account_deletion_control (
  singleton boolean primary key default true check (singleton),
  accepting_requests boolean not null default false
);
insert into private.account_deletion_control (singleton) values (true);
alter table private.account_deletion_control enable row level security;
revoke all on private.account_deletion_control from public, anon, authenticated;

create function private.account_deletion_purge_after(deadline timestamptz)
returns timestamptz language sql immutable strict set search_path = '' as $$
  select (date_trunc('day', deadline at time zone 'Asia/Tokyo') + interval '3 hours'
    + case when (deadline at time zone 'Asia/Tokyo')::time > time '03:00'
      then interval '1 day' else interval '0 days' end) at time zone 'Asia/Tokyo';
$$;
create index account_deletion_due
  on private.account_deletion_requests (private.account_deletion_purge_after(delete_after), request_id)
  include (auth_user_id, next_attempt_at) where status = 'pending';

create function private.account_deletion_lock_key(subject uuid)
returns bigint language sql immutable strict set search_path = '' as $$
  select pg_catalog.hashtextextended('account-deletion:' || subject::text, 0);
$$;

create function private.is_account_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users where id = auth.uid())
    and exists (select 1 from public.users where auth_user_id = auth.uid())
    and not exists (
      select 1 from private.account_deletion_requests
      where auth_user_id = auth.uid() and status = 'pending'
    );
$$;

-- SECURITY DEFINERな既存RPCから呼ばれても、同じ停止認可を通す。
create or replace function public.get_authenticated_user_id()
returns bigint language plpgsql stable security invoker set search_path = '' as $$
declare
  user_id bigint;
begin
  if not private.is_account_active() then
    raise exception 'Account is unavailable.' using errcode = '42501';
  end if;
  select id into user_id from public.users where auth_user_id = auth.uid();
  if user_id is null then
    raise exception 'Account is unavailable.' using errcode = '42501';
  end if;
  return user_id;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['users', 'books', 'book_members', 'payments', 'categories', 'category_pins', 'monthly_budgets', 'category_budgets'] loop
    execute format('create policy "Active account required" on public.%I as restrictive for all to authenticated using ((select private.is_account_active())) with check ((select private.is_account_active()))', table_name);
  end loop;
end;
$$;

create or replace function public.ensure_authenticated_user(p_initial_display_name text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  subject uuid := auth.uid();
  authenticated_email text := trim(auth.jwt() ->> 'email');
  existing_user_id bigint;
begin
  if subject is null or nullif(authenticated_email, '') is null then
    raise exception 'Authenticated user is required.' using errcode = '42501';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(private.account_deletion_lock_key(subject));
  if not exists (select 1 from auth.users where id = subject)
    or exists (select 1 from private.account_deletion_requests where auth_user_id = subject and status = 'pending') then
    raise exception 'Account is unavailable.' using errcode = '42501';
  end if;
  select id into existing_user_id from public.users where auth_user_id = subject;
  if existing_user_id is not null then return; end if;
  if exists (select 1 from public.users where email = authenticated_email) then
    raise exception 'User account cannot be synchronized. Sign out and sign in again before continuing.';
  end if;
  insert into public.users (auth_user_id, name, email)
    values (subject, p_initial_display_name, authenticated_email)
    on conflict (auth_user_id) do nothing;
exception when unique_violation then
  raise exception 'User account cannot be synchronized. Sign out and sign in again before continuing.';
end;
$$;

-- iatやブラウザのmarkerではなく、Authに実在する同一sessionの作成時刻を使う。
create function private.require_account_session(fresh boolean default false, newer_than timestamptz default null)
returns timestamptz language plpgsql volatile security definer set search_path = '' as $$
declare
  session_created timestamptz;
  checked_at timestamptz;
begin
  select s.created_at into session_created
  from auth.sessions s join auth.users u on u.id = s.user_id
  where s.id::text = auth.jwt() ->> 'session_id' and s.user_id = auth.uid();
  checked_at := clock_timestamp();
  if session_created is null or session_created > checked_at then
    raise exception 'Valid account session required.' using errcode = '42501';
  end if;
  if fresh and session_created < checked_at - interval '5 minutes' then
    raise exception 'Fresh Google sign-in required.' using errcode = '42501';
  end if;
  if newer_than is not null and session_created <= newer_than then
    raise exception 'New Google sign-in required.' using errcode = '42501';
  end if;
  return session_created;
end;
$$;

create function private.account_deletion_result(request private.account_deletion_requests)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('status', request.status, 'delete_after', request.delete_after,
    'purge_after', private.account_deletion_purge_after(request.delete_after));
$$;

create function private.prepare_account_deletion()
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  subject uuid := auth.uid();
  app_user_id bigint;
  preview_at timestamptz;
  sole_count integer;
  shared_count integer;
begin
  perform private.require_account_session();
  app_user_id := public.get_authenticated_user_id();
  select count(*) filter (where members = 1), count(*) filter (where members > 1)
    into sole_count, shared_count
  from (
    select (select count(*) from public.book_members other where other.book_id = mine.book_id) members
    from public.book_members mine where mine.user_id = app_user_id
  ) counts;
  preview_at := clock_timestamp();
  return jsonb_build_object(
    'auth_user_id', subject, 'email', (select email from auth.users where id = subject),
    'explanation_version', '2026-11-06', 'sole_book_count', sole_count, 'shared_book_count', shared_count,
    'delete_after', preview_at + interval '168 hours',
    'purge_after', private.account_deletion_purge_after(preview_at + interval '168 hours'),
    'accepting_requests', (select accepting_requests from private.account_deletion_control where singleton)
  );
end;
$$;

create function private.request_account_deletion(request_id uuid, result_secret text, explanation_version text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  subject uuid := auth.uid();
  request private.account_deletion_requests;
  requested timestamptz;
  secret_hash bytea;
begin
  perform private.require_account_session();
  if request_id is null or result_secret is null or result_secret !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid deletion request.' using errcode = '22023';
  end if;
  secret_hash := extensions.digest(result_secret, 'sha256');
  perform pg_catalog.pg_advisory_xact_lock(private.account_deletion_lock_key(subject));
  select * into request from private.account_deletion_requests r where r.request_id = $1 for update;
  if found then
    if request.auth_user_id <> subject or request.result_secret_hash <> secret_hash then
      raise exception 'Invalid deletion request.' using errcode = '22023';
    end if;
    if request.finished_at <= clock_timestamp() - interval '720 hours' then
      return jsonb_build_object('status', 'not_confirmed');
    end if;
    return private.account_deletion_result(request);
  end if;
  perform private.require_account_session();
  if explanation_version is distinct from '2026-11-06' then
    raise exception 'Refresh the deletion explanation.' using errcode = '22023';
  end if;
  if exists (select 1 from private.account_deletion_requests r where r.auth_user_id = subject and r.status = 'pending') then
    raise exception 'An account deletion is already pending.' using errcode = '23505';
  end if;
  perform public.get_authenticated_user_id();
  if not (select accepting_requests from private.account_deletion_control where singleton) then
    raise exception 'Account deletion requests are unavailable.' using errcode = '55000';
  end if;
  requested := clock_timestamp();
  insert into private.account_deletion_requests
    (request_id, auth_user_id, result_secret_hash, requested_at, delete_after, explanation_version, next_attempt_at)
  values ($1, subject, secret_hash, requested, requested + interval '168 hours', $3, requested)
  returning * into request;
  return private.account_deletion_result(request);
end;
$$;

create function private.get_my_account_deletion_state()
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare request private.account_deletion_requests;
begin
  perform private.require_account_session();
  select * into request from private.account_deletion_requests
    where auth_user_id = auth.uid() and status = 'pending';
  if not found then return jsonb_build_object('status', 'active'); end if;
  return private.account_deletion_result(request) || jsonb_build_object(
    'request_id', request.request_id, 'can_reactivate', clock_timestamp() < request.delete_after);
end;
$$;

create function private.reactivate_my_account(request_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare request private.account_deletion_requests;
begin
  perform private.require_account_session();
  perform pg_catalog.pg_advisory_xact_lock(private.account_deletion_lock_key(auth.uid()));
  select * into request from private.account_deletion_requests r
    where r.request_id = $1 and r.auth_user_id = auth.uid() for update;
  if not found or request.status = 'completed'
    or request.finished_at <= clock_timestamp() - interval '720 hours' then
    raise exception 'Account deletion cannot be cancelled.' using errcode = '42501';
  end if;
  perform private.require_account_session(true, request.requested_at);
  if exists (select 1 from private.account_deletion_requests r
    where r.auth_user_id = auth.uid() and r.status = 'pending' and r.request_id <> $1) then
    raise exception 'A different account deletion is pending.' using errcode = '42501';
  end if;
  if request.status = 'cancelled' then return private.account_deletion_result(request); end if;
  if clock_timestamp() >= request.delete_after then
    raise exception 'Account reactivation deadline has passed.' using errcode = '42501';
  end if;
  update private.account_deletion_requests r set status = 'cancelled', finished_at = clock_timestamp()
    where r.request_id = $1 returning * into request;
  return private.account_deletion_result(request);
end;
$$;

create function private.get_account_deletion_result(request_id uuid, result_secret text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare request private.account_deletion_requests;
begin
  if result_secret is null or result_secret !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status', 'not_confirmed');
  end if;
  select * into request from private.account_deletion_requests r
  where r.request_id = $1 and r.result_secret_hash = extensions.digest(result_secret, 'sha256')
    and (r.status = 'pending' or r.finished_at > clock_timestamp() - interval '720 hours');
  if not found then return jsonb_build_object('status', 'not_confirmed'); end if;
  return private.account_deletion_result(request);
end;
$$;

create function public.prepare_account_deletion()
returns jsonb language sql volatile security invoker set search_path = '' as $$ select private.prepare_account_deletion(); $$;
create function public.request_account_deletion(request_id uuid, result_secret text, explanation_version text)
returns jsonb language sql volatile security invoker set search_path = '' as $$ select private.request_account_deletion($1, $2, $3); $$;
create function public.get_my_account_deletion_state()
returns jsonb language sql volatile security invoker set search_path = '' as $$ select private.get_my_account_deletion_state(); $$;
create function public.reactivate_my_account(request_id uuid)
returns jsonb language sql volatile security invoker set search_path = '' as $$ select private.reactivate_my_account($1); $$;
create function public.get_account_deletion_result(request_id uuid, result_secret text)
returns jsonb language sql volatile security invoker set search_path = '' as $$ select private.get_account_deletion_result($1, $2); $$;

-- 削除と復旧時の再削除で同じcascadeを使う。呼出元はaccount/request lockを所有する。
create function private.purge_account(subject uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  app_user_id bigint;
  book_ids bigint[];
  orphan_ids bigint[];
  storage_owned boolean;
begin
  perform 1 from auth.users where id = subject for update;
  if not found then raise exception 'auth_missing' using errcode = 'P2081'; end if;
  select id into app_user_id from public.users where auth_user_id = subject;
  select coalesce(array_agg(book_id order by book_id), '{}'::bigint[]) into book_ids
    from public.book_members where book_members.user_id = app_user_id;
  perform 1 from public.books where id = any(book_ids) order by id for update;
  -- lock待機後のsnapshotで、最後のmembershipかどうかを再検査する。
  select coalesce(array_agg(b.id), '{}'::bigint[]) into orphan_ids from public.books b
  where b.id = any(book_ids) and not exists (
    select 1 from public.book_members m where m.book_id = b.id and m.user_id <> app_user_id
  );
  if to_regclass('storage.objects') is not null then
    execute 'select exists (select 1 from storage.objects where owner_id = $1 or owner::text = $1)'
      into storage_owned using subject::text;
    if storage_owned then raise exception 'storage_dependency' using errcode = 'P2082'; end if;
  end if;
  if exists (
    with recursive dependents(rel) as (
      select unnest(array['auth.users'::regclass::oid, 'public.books'::regclass::oid])
      union select f.conrelid from pg_catalog.pg_constraint f join dependents d on d.rel = f.confrelid where f.contype = 'f'
    ) select 1 from dependents d join pg_catalog.pg_class c on c.oid = d.rel
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname || '.' || c.relname <> all(array[
      'auth.users', 'auth.identities', 'auth.sessions', 'auth.refresh_tokens', 'auth.mfa_factors',
      'auth.mfa_challenges', 'auth.mfa_amr_claims', 'auth.one_time_tokens', 'auth.oauth_authorizations',
      'auth.oauth_consents', 'auth.webauthn_challenges', 'auth.webauthn_credentials',
      'auth.scim_users', 'auth.mfa_recovery_code_sets', 'auth.mfa_recovery_codes',
      'public.users', 'public.books', 'public.book_members', 'public.payments', 'public.categories',
      'public.category_pins', 'public.monthly_budgets', 'public.category_budgets'
    ])
  ) then raise exception 'unknown_dependency' using errcode = 'P2083'; end if;
  delete from auth.users where id = subject;
  if exists (select 1 from auth.users where id = subject)
    or exists (select 1 from public.users where auth_user_id = subject)
    or exists (select 1 from public.book_members m where m.user_id = app_user_id)
    or exists (select 1 from public.books where id = any(orphan_ids)) then
    raise exception 'integrity' using errcode = 'P2084';
  end if;
end;
$$;

create function private.delete_account_request(target uuid)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare
  request private.account_deletion_requests;
  subject uuid;
  failure text;
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'READ COMMITTED is required.';
  end if;
  select auth_user_id into subject from private.account_deletion_requests where request_id = target;
  if subject is null or not pg_catalog.pg_try_advisory_xact_lock(private.account_deletion_lock_key(subject)) then return false; end if;
  select * into request from private.account_deletion_requests where request_id = target for update;
  if request.status <> 'pending' or request.delete_after > clock_timestamp()
    or private.account_deletion_purge_after(request.delete_after) > clock_timestamp()
    or request.next_attempt_at > clock_timestamp() then return false; end if;
  begin
    perform private.purge_account(subject);
    update private.account_deletion_requests set status = 'completed', finished_at = clock_timestamp(), last_error = null
      where request_id = target;
    return true;
  exception
    when sqlstate 'P2081' then failure := 'auth_missing';
    when sqlstate 'P2082' then failure := 'storage_dependency';
    when sqlstate 'P2083' then failure := 'unknown_dependency';
    when sqlstate 'P2084' or integrity_constraint_violation then failure := 'integrity';
    when lock_not_available or deadlock_detected then failure := 'lock_timeout';
    when others then failure := 'database_error';
  end;
  -- statement timeoutは捕捉せずbatchごとrollbackし、運用の単件切り分けへ渡す。
  update private.account_deletion_requests
    set retry_count = least(retry_count + 1, 1000000), last_error = failure,
      next_attempt_at = clock_timestamp() + make_interval(secs => least(3600, 60 * power(2, least(retry_count, 6)))::integer)
    where request_id = target;
  return false;
end;
$$;

create function private.delete_due_accounts()
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare candidate record; deleted integer := 0;
begin
  -- pg_cronが遅延tickを再生しても、03時台以外に新しい削除を開始しない。
  if extract(hour from clock_timestamp() at time zone 'Asia/Tokyo') <> 3 then return 0; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('account-deletion-batch', 0)) then return 0; end if;
  for candidate in
    select request_id from private.account_deletion_requests
    where status = 'pending' and private.account_deletion_purge_after(delete_after) <= statement_timestamp()
      and next_attempt_at <= statement_timestamp()
    order by private.account_deletion_purge_after(delete_after), request_id limit 10
  loop
    exit when extract(hour from clock_timestamp() at time zone 'Asia/Tokyo') <> 3;
    if private.delete_account_request(candidate.request_id) then deleted := deleted + 1; end if;
  end loop;
  return deleted;
end;
$$;

create function private.defer_account_deletion(target uuid, retry_at timestamptz)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare subject uuid;
begin
  if retry_at is null or retry_at <= clock_timestamp() then raise exception 'Future retry time required.'; end if;
  select auth_user_id into subject from private.account_deletion_requests where request_id = target;
  if subject is null then raise exception 'Pending request required.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(private.account_deletion_lock_key(subject));
  perform 1 from private.account_deletion_requests where request_id = target and status = 'pending' for update;
  if not found then raise exception 'Pending request required.'; end if;
  update private.account_deletion_requests set next_attempt_at = retry_at, last_error = 'lock_timeout',
    retry_count = least(retry_count + 1, 1000000) where request_id = target;
end;
$$;

create function private.clean_account_deletion_results()
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare deleted integer;
begin
  delete from private.account_deletion_requests
    where status <> 'pending' and finished_at <= clock_timestamp() - interval '720 hours';
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

-- 通信を閉じた復旧先だけで使う。入力は復旧元以後を含む、検証済みの最新状態一覧。
create function private.restore_account_deletion_requests(latest jsonb)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  restored private.account_deletion_requests;
  previous private.account_deletion_requests;
begin
  if jsonb_typeof(latest) is distinct from 'array' then raise exception 'Verified request state array required.'; end if;
  if (select count(*) <> count(distinct request_id) from jsonb_populate_recordset(null::private.account_deletion_requests, latest)) then
    raise exception 'Duplicate request states.';
  end if;
  update private.account_deletion_control set accepting_requests=false;
  -- 取消と完了を先に適用し、同じ本人の次のpending要求との一意制約を保つ。
  for restored in select * from jsonb_populate_recordset(null::private.account_deletion_requests, latest)
    order by case status when 'cancelled' then 0 when 'completed' then 1 else 2 end, auth_user_id, request_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(private.account_deletion_lock_key(restored.auth_user_id));
    select * into previous from private.account_deletion_requests where request_id=restored.request_id for update;
    if found and (
      previous.auth_user_id is distinct from restored.auth_user_id or
      previous.requested_at is distinct from restored.requested_at or
      previous.delete_after is distinct from restored.delete_after or
      previous.result_secret_hash is distinct from restored.result_secret_hash or
      previous.explanation_version is distinct from restored.explanation_version or
      (previous.status <> 'pending' and previous.status is distinct from restored.status)
    ) then raise exception 'Restore request state conflicts with stored identity or transition.'; end if;
    insert into private.account_deletion_requests select restored.*
      on conflict (request_id) do update set status=excluded.status, finished_at=excluded.finished_at,
        retry_count=excluded.retry_count, next_attempt_at=excluded.next_attempt_at, last_error=excluded.last_error;
    if restored.status='completed' then
      if exists (select 1 from auth.users where id=restored.auth_user_id) then
        perform private.purge_account(restored.auth_user_id);
      end if;
      if exists (select 1 from public.users where auth_user_id=restored.auth_user_id) then
        raise exception 'Restored deleted account remains.';
      end if;
    end if;
  end loop;
  if exists (select 1 from private.account_deletion_requests r where r.status='pending'
    and (not exists (select 1 from auth.users u where u.id=r.auth_user_id)
      or not exists (select 1 from public.users u where u.auth_user_id=r.auth_user_id))) then
    raise exception 'Pending account data is missing from restored backup.';
  end if;
end;
$$;

-- migrationの適用だけでは受付もCronも有効にしない。公開手順で承認後に切り替える。
do $$ begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'account_deletion_admin') then
    create role account_deletion_admin nologin noinherit;
  end if;
end; $$;
grant usage on schema private to account_deletion_admin;

revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated, service_role;
grant execute on function private.is_account_active() to authenticated, service_role;
grant execute on function private.prepare_account_deletion(), private.request_account_deletion(uuid, text, text),
  private.get_my_account_deletion_state(), private.reactivate_my_account(uuid) to authenticated;
grant execute on function private.get_account_deletion_result(uuid, text) to anon, authenticated;
grant execute on function private.delete_due_accounts(), private.delete_account_request(uuid),
  private.defer_account_deletion(uuid, timestamptz), private.clean_account_deletion_results(),
  private.restore_account_deletion_requests(jsonb) to account_deletion_admin;

revoke all on function public.prepare_account_deletion(), public.request_account_deletion(uuid, text, text),
  public.get_my_account_deletion_state(), public.reactivate_my_account(uuid), public.get_account_deletion_result(uuid, text)
  from public, anon, authenticated;
grant execute on function public.prepare_account_deletion(), public.request_account_deletion(uuid, text, text),
  public.get_my_account_deletion_state(), public.reactivate_my_account(uuid) to authenticated;
grant execute on function public.get_account_deletion_result(uuid, text) to anon, authenticated;
