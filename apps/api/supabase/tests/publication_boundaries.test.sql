begin;
set local time zone 'Asia/Tokyo';

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(48);

-- postgresによる将来のpublic表も既定権限だけでTRUNCATEを拒否する。
-- 一時schemaではpublicのdefault privilegesを検証できないので、transaction内で作成する。
create table public.publication_future_table (id integer primary key);
alter table public.publication_future_table enable row level security;
select ok(not has_table_privilege(role_name, 'public.publication_future_table', 'TRUNCATE'),
  role_name || ' cannot truncate a future postgres table')
from unnest(array['anon', 'authenticated']) as role_name;
select ok((select bool_and(has_table_privilege(role_name, 'public.publication_future_table', privilege))
  from unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) as privilege),
  role_name || ' retains CRUD privileges on a future postgres table')
from unnest(array['anon', 'authenticated']) as role_name;
select ok(has_table_privilege('service_role', 'public.publication_future_table', 'TRUNCATE'),
  'service role default is unchanged');
select ok(has_table_privilege('postgres', 'public.publication_future_table', 'TRUNCATE'),
  'table owner privilege is unchanged');
set local role anon;
select throws_ok($$truncate public.publication_future_table$$, '42501',
  'permission denied for table publication_future_table', 'anon future table truncate is rejected');
reset role;
set local role authenticated;
select throws_ok($$truncate public.publication_future_table$$, '42501',
  'permission denied for table publication_future_table', 'authenticated future table truncate is rejected');
reset role;

-- 合成データだけを使い、最後に全変更をrollbackする。
insert into auth.users (id, email) values
  ('18850000-0000-0000-0000-000000000001', 'publication-a@example.com'),
  ('18850000-0000-0000-0000-000000000002', 'publication-b@example.com');

select set_config('request.jwt.claims', '{"sub":"18850000-0000-0000-0000-000000000001","email":"publication-a@example.com"}', true);
set local role authenticated;
select public.ensure_authenticated_user('Publication A');
select public.create_category_with_pin_and_budget('Publication A', false, date_trunc('month', current_date)::date, 1000);
select public.create_monthly_budget(date_trunc('month', statement_timestamp() at time zone 'Asia/Tokyo')::date, 2000);
insert into public.payments (date, amount) values (current_date, 10);
reset role;

select set_config('request.jwt.claims', '{"sub":"18850000-0000-0000-0000-000000000002","email":"publication-b@example.com"}', true);
set local role authenticated;
select public.ensure_authenticated_user('Publication B');
select public.create_category_with_pin_and_budget('Publication B', false, date_trunc('month', current_date)::date, 3000);
select public.create_monthly_budget(date_trunc('month', statement_timestamp() at time zone 'Asia/Tokyo')::date, 4000);
insert into public.payments (date, amount) values (current_date, 20);
reset role;

create temp table publication_other_book as
  select book_id from public.book_members
  join public.users on users.id = book_members.user_id
  where auth_user_id = '18850000-0000-0000-0000-000000000002';
grant select on publication_other_book to authenticated;

select ok(not has_table_privilege(role_name, format('public.%I', table_name), 'TRUNCATE'),
  role_name || ' cannot truncate ' || table_name)
from unnest(array['anon', 'authenticated']) as role_name
cross join unnest(array['users', 'books', 'book_members', 'categories', 'payments',
  'monthly_budgets', 'category_budgets', 'category_pins']) as table_name;

select set_config('request.jwt.claims', '{"sub":"18850000-0000-0000-0000-000000000001","email":"publication-a@example.com"}', true);
set local role authenticated;

select is((select count(*) from public.users), 1::bigint, 'profile reads only self');
select is((select name::text from public.users), 'Publication A', 'profile belongs to A');
select lives_ok($$update public.users set name = 'Publication A updated'$$, 'own profile remains writable');
select is((select name::text from public.users), 'Publication A updated', 'own profile update affected the row');
select is((select count(*) from public.books), 1::bigint, 'only own book is visible');
select is((select count(*) from public.book_members), 1::bigint, 'only own membership is visible');
select is((select count(*) from public.categories), 1::bigint, 'only own category is visible');
select is((select sum(amount)::bigint from public.payments), 10::bigint, 'payments exclude other book');
select is(public.get_monthly_total_amount(to_char(current_date, 'YYYY-MM'))::bigint, 10::bigint, 'monthly total excludes other book');
select is((select count(*) from public.monthly_budgets), 1::bigint, 'monthly budgets exclude other book');
select is((select count(*) from public.category_budgets), 1::bigint, 'category budgets exclude other book');
select is((public.get_effective_monthly_budget(current_date) #>> '{monthly_budget,amount}')::numeric, 2000::numeric, 'effective monthly budget is preserved');
select is((public.get_effective_category_budgets(current_date) #>> '{0,amount}')::numeric, 1000::numeric, 'effective category budget is preserved');
with changed as (
  update public.payments set amount = 999 where book_id = (select book_id from publication_other_book) returning id
) select is(count(*), 0::bigint, 'cannot update another book payment') from changed;
with changed as (
  delete from public.payments where book_id = (select book_id from publication_other_book) returning id
) select is(count(*), 0::bigint, 'cannot delete another book payment') from changed;
select throws_ok($$insert into public.payments (book_id, date, amount)
  select book_id, current_date, 99 from publication_other_book$$,
  '42501', null, 'cannot insert into another book');
select throws_ok($$update public.users set auth_user_id = '18850000-0000-0000-0000-000000000002'$$,
  '42501', null, 'cannot change identity');
select throws_ok($$truncate public.payments$$, '42501', null, 'truncate is rejected before touching data');

-- 同じ接続でJWTを切り替えてもInitPlanの本人判定を次のstatementへ持ち越さない。
select set_config('request.jwt.claims', '{"sub":"18850000-0000-0000-0000-000000000002","email":"publication-b@example.com"}', true);
select is((select name::text from public.users), 'Publication B', 'next statement follows changed identity');
select is((select sum(amount)::bigint from public.payments), 20::bigint, 'other user data remains intact');
select set_config('request.jwt.claims', '{}', true);
select is((select count(*) from public.users), 0::bigint, 'missing JWT cannot read profiles');
reset role;
set local role anon;
select throws_ok($$select * from public.payments$$, '42501', null, 'anon cannot read payments');
select throws_ok($$select public.ensure_authenticated_user('Anonymous')$$, '42501', null, 'anon cannot invoke synchronization RPC');
select throws_ok($$truncate public.payments$$, '42501', null, 'anon cannot truncate');
reset role;

select * from finish();
rollback;
