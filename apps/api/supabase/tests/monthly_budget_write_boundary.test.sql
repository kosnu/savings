begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(27);

insert into auth.users (id, email)
values ('20000000-0000-0000-0000-000000000001', 'monthly-budget-boundary@example.com');

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '20000000-0000-0000-0000-000000000001',
    'email', 'monthly-budget-boundary@example.com'
  )::text,
  true
);
set local role authenticated;
select public.ensure_authenticated_user('Monthly Budget Boundary User');
reset role;

insert into public.books (name)
values ('Monthly Budget Boundary Other Book');

create temp table monthly_budget_write_fixture on commit drop as
select
  users.id as user_id,
  default_members.book_id as default_book_id,
  other_books.id as other_book_id,
  dates.current_month_start,
  month_values.past_month,
  month_values.stale_month,
  month_values.none_month,
  month_values.future_month
from public.users
join public.book_members as default_members
  on default_members.user_id = users.id
  and default_members.is_default
cross join lateral (
  select id
  from public.books
  where name = 'Monthly Budget Boundary Other Book'
  order by id desc
  limit 1
) as other_books
cross join lateral (
  select date_trunc('month', current_date)::date as current_month_start
) as dates
cross join lateral (
  select
    (dates.current_month_start - interval '1 month')::date as past_month,
    (dates.current_month_start - interval '2 months')::date as stale_month,
    (dates.current_month_start - interval '3 months')::date as none_month,
    (dates.current_month_start + interval '1 month')::date as future_month
) as month_values
where users.auth_user_id = '20000000-0000-0000-0000-000000000001';

grant select on monthly_budget_write_fixture to authenticated;

insert into public.monthly_budgets (book_id, effective_from, status, amount)
select default_book_id, past_month, 'amount', 100
from monthly_budget_write_fixture;

insert into public.monthly_budgets (book_id, effective_from, status, amount)
select default_book_id, stale_month, 'amount', 50
from monthly_budget_write_fixture;

insert into public.monthly_budgets (book_id, effective_from, status, amount)
select default_book_id, future_month, 'amount', 500
from monthly_budget_write_fixture;

insert into public.monthly_budgets (book_id, effective_from, status, amount)
select default_book_id, none_month, 'none', null
from monthly_budget_write_fixture;

insert into public.monthly_budgets (book_id, effective_from, status, amount)
select other_book_id, past_month, 'amount', 900
from monthly_budget_write_fixture;

select is(
  has_table_privilege('authenticated', 'public.monthly_budgets', 'INSERT'),
  false,
  'authenticatedはmonthly_budgetsへinsertできない'
);
select is(
  has_table_privilege('authenticated', 'public.monthly_budgets', 'UPDATE'),
  false,
  'authenticatedはmonthly_budgetsをupdateできない'
);
select is(
  has_table_privilege('authenticated', 'public.monthly_budgets', 'DELETE'),
  false,
  'authenticatedはmonthly_budgetsをdeleteできない'
);

set local role authenticated;

select throws_ok(
  $$
    insert into public.monthly_budgets (book_id, effective_from, status, amount)
    values (1, date_trunc('month', current_date)::date, 'amount', 999)
  $$,
  '42501',
  'permission denied for table monthly_budgets',
  'authenticatedのdirect insertを拒否する'
);
select throws_ok(
  $$
    update public.monthly_budgets
    set amount = 999
    where id = (select id from public.monthly_budgets order by id limit 1)
  $$,
  '42501',
  'permission denied for table monthly_budgets',
  'authenticatedのdirect updateを拒否する'
);
select throws_ok(
  $$
    delete from public.monthly_budgets
    where id = (select id from public.monthly_budgets order by id limit 1)
  $$,
  '42501',
  'permission denied for table monthly_budgets',
  'authenticatedのdirect deleteを拒否する'
);

select is(
  (select p.prosecdef
   from pg_proc as p
   where p.oid = 'public.update_current_monthly_budget(bigint, integer)'::regprocedure),
  true,
  'update RPCはsecurity definerで実行する'
);
select is(
  (select p.prosecdef
   from pg_proc as p
   where p.oid = 'public.create_monthly_budget(date, integer)'::regprocedure),
  true,
  'create RPCはsecurity definerで実行する'
);
select is(
  (select p.prosecdef
   from pg_proc as p
   where p.oid = 'public.remove_current_monthly_budget(bigint)'::regprocedure),
  true,
  'remove RPCはsecurity definerで実行する'
);

select is(
  (public.get_effective_monthly_budget((select past_month from monthly_budget_write_fixture))->'monthly_budget'->>'amount')::numeric,
  100::numeric,
  '更新前の過去月effective結果を保持する'
);

select public.create_monthly_budget(
  (select (future_month + interval '1 month')::date from monthly_budget_write_fixture),
  600
);

select is(
  (select amount
   from public.monthly_budgets
   where book_id = (select default_book_id from monthly_budget_write_fixture)
     and effective_from = (select (future_month + interval '1 month')::date from monthly_budget_write_fixture)),
  600::numeric,
  'table DML撤去後もcreate RPCだけで月予算を作成できる'
);

select public.update_current_monthly_budget(
  (select id
   from public.monthly_budgets
   where book_id = (select default_book_id from monthly_budget_write_fixture)
     and effective_from = (select past_month from monthly_budget_write_fixture)),
  200
);

select is(
  (select amount
   from public.monthly_budgets
   where book_id = (select default_book_id from monthly_budget_write_fixture)
     and effective_from = (select past_month from monthly_budget_write_fixture)),
  100::numeric,
  '過去開始行の金額を更新しない'
);
select is(
  (select amount
   from public.monthly_budgets
   where book_id = (select default_book_id from monthly_budget_write_fixture)
     and effective_from = (select current_month_start from monthly_budget_write_fixture)),
  200::numeric,
  '過去開始行の更新で当月行を追加する'
);

select is(
  (public.get_effective_monthly_budget((select past_month from monthly_budget_write_fixture))->'monthly_budget'->>'amount')::numeric,
  100::numeric,
  '当月write後も過去月effective結果を変えない'
);

select public.update_current_monthly_budget(
  (select id
   from public.monthly_budgets
   where book_id = (select default_book_id from monthly_budget_write_fixture)
     and effective_from = (select current_month_start from monthly_budget_write_fixture)),
  300
);

select is(
  (select amount
   from public.monthly_budgets
   where book_id = (select default_book_id from monthly_budget_write_fixture)
     and effective_from = (select current_month_start from monthly_budget_write_fixture)),
  300::numeric,
  '当月開始行は同じrecordの金額だけを更新する'
);

select public.remove_current_monthly_budget(
  (select id
   from public.monthly_budgets
   where book_id = (select default_book_id from monthly_budget_write_fixture)
     and effective_from = (select current_month_start from monthly_budget_write_fixture))
);

select is(
  (select status
   from public.monthly_budgets
   where book_id = (select default_book_id from monthly_budget_write_fixture)
     and effective_from = (select current_month_start from monthly_budget_write_fixture)),
  'none',
  '当月開始行をnoneへ無効化する'
);
select is(
  (select amount
   from public.monthly_budgets
   where book_id = (select default_book_id from monthly_budget_write_fixture)
     and effective_from = (select current_month_start from monthly_budget_write_fixture)),
  null::numeric,
  'none状態のamountをnullにする'
);

select throws_ok(
  $$
    select public.update_current_monthly_budget(
      (select id
       from public.monthly_budgets
       where book_id = (select default_book_id from monthly_budget_write_fixture)
         and effective_from = (select current_month_start from monthly_budget_write_fixture)),
      400
    )
  $$,
  'P0002',
  'Current monthly budget was not found.',
  'none状態のrecord更新を拒否する'
);
select throws_ok(
  $$
    select public.remove_current_monthly_budget(
      (select id
       from public.monthly_budgets
       where book_id = (select default_book_id from monthly_budget_write_fixture)
         and effective_from = (select current_month_start from monthly_budget_write_fixture))
    )
  $$,
  'P0002',
  'Current monthly budget was not found.',
  'none状態のrecord無効化を拒否する'
);
select throws_ok(
  $$
    select public.update_current_monthly_budget(
      (select id
       from public.monthly_budgets
       where book_id = (select default_book_id from monthly_budget_write_fixture)
         and effective_from = (select future_month from monthly_budget_write_fixture)),
      400
    )
  $$,
  'P0002',
  'Current monthly budget was not found.',
  '未来開始recordの更新を拒否する'
);
select throws_ok(
  $$
    select public.remove_current_monthly_budget(
      (select id
       from public.monthly_budgets
       where book_id = (select default_book_id from monthly_budget_write_fixture)
         and effective_from = (select future_month from monthly_budget_write_fixture))
    )
  $$,
  'P0002',
  'Current monthly budget was not found.',
  '未来開始recordの無効化を拒否する'
);
select throws_ok(
  $$
    select public.update_current_monthly_budget(
      (select id
       from public.monthly_budgets
       where book_id = (select other_book_id from monthly_budget_write_fixture)
         and effective_from = (select past_month from monthly_budget_write_fixture)),
      400
    )
  $$,
  'P0002',
  'Current monthly budget was not found.',
  '非所有Bookのrecord更新を拒否する'
);
select throws_ok(
  $$
    select public.remove_current_monthly_budget(
      (select id
       from public.monthly_budgets
       where book_id = (select other_book_id from monthly_budget_write_fixture)
         and effective_from = (select past_month from monthly_budget_write_fixture))
    )
  $$,
  'P0002',
  'Current monthly budget was not found.',
  '非所有Bookのrecord無効化を拒否する'
);

reset role;
delete from public.monthly_budgets
where book_id = (select default_book_id from monthly_budget_write_fixture)
  and effective_from = (select current_month_start from monthly_budget_write_fixture);
set local role authenticated;

select public.remove_current_monthly_budget(
  (select id
   from public.monthly_budgets
   where book_id = (select default_book_id from monthly_budget_write_fixture)
     and effective_from = (select past_month from monthly_budget_write_fixture))
);

select is(
  (select status
   from public.monthly_budgets
   where book_id = (select default_book_id from monthly_budget_write_fixture)
     and effective_from = (select current_month_start from monthly_budget_write_fixture)),
  'none',
  '過去開始行の無効化で当月none行を追加する'
);
select is(
  (select amount
   from public.monthly_budgets
   where book_id = (select default_book_id from monthly_budget_write_fixture)
     and effective_from = (select past_month from monthly_budget_write_fixture)),
  100::numeric,
  '過去開始行の無効化でも履歴を保持する'
);
select is(
  (public.get_effective_monthly_budget((select current_month_start from monthly_budget_write_fixture))->>'status'),
  'none',
  'none状態をeffective responseへ保持する'
);

select is(
  (public.get_effective_monthly_budget(
    (select (none_month - interval '1 month')::date from monthly_budget_write_fixture)
  )->>'status'),
  'unset',
  '未設定状態をeffective responseへ保持する'
);

select * from finish();
rollback;
