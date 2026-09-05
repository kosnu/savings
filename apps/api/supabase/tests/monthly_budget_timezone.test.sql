begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

insert into auth.users (id, email)
values ('20000000-0000-0000-0000-000000001517', 'monthly-budget-timezone@example.com');
select set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000001517","email":"monthly-budget-timezone@example.com"}', true);
set local role authenticated;
select public.ensure_authenticated_user('Monthly Budget Timezone User');
reset role;

-- 本番に時計の注入口を作らず、rollback内で時刻取得だけを差し替える。
-- 月換算・ID認可・履歴遷移はpg_get_functiondefから得た実際のRPC本体を通す。
create function pg_temp.check_monthly_budget_timezones() returns setof text
language plpgsql as $$
declare
  definitions text[] := array[
    pg_get_functiondef('public.create_monthly_budget(date,integer)'::regprocedure),
    pg_get_functiondef('public.update_current_monthly_budget(bigint,integer)'::regprocedure),
    pg_get_functiondef('public.remove_current_monthly_budget(bigint)'::regprocedure)
  ];
  definition text;
  zone text;
  boundary record;
  book bigint := public.get_authenticated_default_book_id();
  current_id bigint;
  future_id bigint;
  past_id bigint;
  stale_id bigint;
  past_month date;
  future_month date;
  label text;
begin
  foreach definition in array definitions loop
    return next ok(position('statement_timestamp()' in definition) > 0, 'writeはDB statement開始時刻を使う');
    return next ok(position('current_date' in definition) = 0, 'writeはsession timezoneの日付を使わない');
  end loop;
  foreach zone in array array['UTC', 'Asia/Tokyo', 'America/Los_Angeles'] loop
    perform set_config('TimeZone', zone, true);
    for boundary in select * from (values
      ('2026-09-30 14:59:59.999999+00'::timestamptz, date '2026-09-01'),
      ('2026-09-30 15:00:00+00'::timestamptz, date '2026-10-01'),
      ('2026-12-31 14:59:59.999999+00'::timestamptz, date '2026-12-01'),
      ('2026-12-31 15:00:00+00'::timestamptz, date '2027-01-01'),
      ('2028-02-29 14:59:59.999999+00'::timestamptz, date '2028-02-01'),
      ('2028-02-29 15:00:00+00'::timestamptz, date '2028-03-01')
    ) as cases(instant, month_start) loop
      label := zone || ' / ' || boundary.instant::text;
      foreach definition in array definitions loop
        execute replace(definition, 'statement_timestamp()', format('%L::timestamptz', boundary.instant));
      end loop;
      delete from public.monthly_budgets where book_id = book;
      past_month := (boundary.month_start - interval '1 month')::date;
      future_month := (boundary.month_start + interval '1 month')::date;
      execute 'set local role authenticated';
      return next throws_ok(format('select public.create_monthly_budget(%L::date, 100)', past_month),
        'P0001', 'Monthly budget month cannot be before current month.', label || ' 前月作成拒否');
      return next lives_ok(format('select public.create_monthly_budget(%L::date, 100)', boundary.month_start + 15), label || ' 当月作成');
      select id into current_id from public.monthly_budgets where book_id = book and effective_from = boundary.month_start;
      return next ok(current_id is not null, label || ' date-only作成月は月初に正規化');
      return next lives_ok(format('select public.create_monthly_budget(%L::date, 500)', future_month), label || ' 翌月作成');
      select id into future_id from public.monthly_budgets where book_id = book and effective_from = future_month;
      return next throws_ok(format('select public.update_current_monthly_budget(%s, 600)', future_id),
        'P0002', 'Current monthly budget was not found.', label || ' 未来行更新拒否');
      return next throws_ok(format('select public.remove_current_monthly_budget(%s)', future_id),
        'P0002', 'Current monthly budget was not found.', label || ' 未来行無効化拒否');
      perform public.update_current_monthly_budget(current_id, 200);
      return next is((select amount from public.monthly_budgets where id = current_id), 200::numeric, label || ' 当月行更新');
      perform public.remove_current_monthly_budget(current_id);
      return next is((select status from public.monthly_budgets where id = current_id), 'none', label || ' 当月行無効化');
      return next throws_ok(format('select public.update_current_monthly_budget(%s, 600)', current_id),
        'P0002', 'Current monthly budget was not found.', label || ' none更新拒否');
      return next throws_ok(format('select public.remove_current_monthly_budget(%s)', current_id),
        'P0002', 'Current monthly budget was not found.', label || ' none無効化拒否');
      execute 'reset role';
      delete from public.monthly_budgets where book_id = book;
      insert into public.monthly_budgets (book_id, effective_from, status, amount)
      values (book, past_month - interval '1 month', 'amount', 50) returning id into stale_id;
      insert into public.monthly_budgets (book_id, effective_from, status, amount)
      values (book, past_month, 'amount', 100) returning id into past_id;
      execute 'set local role authenticated';
      return next throws_ok(format('select public.update_current_monthly_budget(%s, 600)', stale_id),
        'P0002', 'Current monthly budget was not found.', label || ' stale更新拒否');
      return next throws_ok(format('select public.remove_current_monthly_budget(%s)', stale_id),
        'P0002', 'Current monthly budget was not found.', label || ' stale無効化拒否');
      perform public.update_current_monthly_budget(past_id, 300);
      return next is((select amount from public.monthly_budgets where id = past_id), 100::numeric, label || ' 更新で過去行保持');
      return next is((select amount from public.monthly_budgets where book_id = book and effective_from = boundary.month_start), 300::numeric, label || ' 更新反映月はJST当月');
      return next is(public.get_effective_monthly_budget(past_month)->>'status', 'amount', label || ' 過去表示amount保持');
      execute 'reset role';
      delete from public.monthly_budgets where book_id = book and effective_from = boundary.month_start;
      execute 'set local role authenticated';
      perform public.remove_current_monthly_budget(past_id);
      return next is((select amount from public.monthly_budgets where id = past_id), 100::numeric, label || ' 無効化で過去行保持');
      return next is((select status from public.monthly_budgets where book_id = book and effective_from = boundary.month_start), 'none', label || ' 無効化反映月はJST当月');
      return next is(public.get_effective_monthly_budget(boundary.month_start)->>'status', 'none', label || ' 過去amountは当月に復活しない');
      return next is(public.get_effective_monthly_budget(past_month)->>'status', 'amount', label || ' 無効化後の過去表示保持');
      execute 'reset role';
    end loop;
  end loop;
  -- 同じtransaction内の別statementも、DBで取得した時刻を使う定義に戻す。
  foreach definition in array definitions loop execute definition; end loop;
end;
$$;
select * from pg_temp.check_monthly_budget_timezones();
select * from finish();
rollback;
