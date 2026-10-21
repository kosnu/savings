begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select no_plan();

insert into auth.users (id, email)
values ('16460000-0000-0000-0000-000000000001', 'export-payments@example.com');
select set_config('request.jwt.claims', '{"sub":"16460000-0000-0000-0000-000000000001","email":"export-payments@example.com"}', true);
set local role authenticated;
select public.ensure_authenticated_user('Export User');
reset role;
create temp table export_fixture as select public.get_authenticated_default_book_id() as book_id;
grant select on export_fixture to authenticated;
insert into public.books(name) values ('Export Other Book');
create temp table export_other_fixture as select id from public.books where name = 'Export Other Book';
grant select on export_other_fixture to authenticated;
insert into public.payments(book_id, date, amount, note)
select book_id, d, 1234, '日本語,"改行' || chr(10) || 'メモ'
from export_fixture cross join unnest(array['2024-02-28'::date, '2024-02-29', '2025-02-28', '2025-03-01']) d;
insert into public.payments(book_id, date, amount) select id, '2024-02-29', 99 from public.books where name = 'Export Other Book';

select ok(not has_function_privilege('anon', 'public.export_payments(bigint,date,date)', 'execute'), '未認証には実行権限がない');
select ok((select not prosecdef and provolatile = 's' from pg_proc where oid = 'public.export_payments(bigint,date,date)'::regprocedure), '呼出者権限のSTABLE読取関数');
set local role authenticated;
select is((public.export_payments((select book_id from export_fixture), '2024-02-29', '2025-02-28')->>'count')::int, 2, 'うるう日開始の1年は両端を含み期間外を除く');
select is(jsonb_array_length(public.export_payments((select book_id from export_fixture), '2024-02-29', '2025-02-28')->'payments'), 2, 'countと明細が一致する');
select is(public.export_payments((select book_id from export_fixture), '2024-02-29', '2024-02-29')->'payments'->0->'category', 'null'::jsonb, 'カテゴリ未設定を落とさない');
select is(public.export_payments((select book_id from export_fixture), '2024-02-29', '2024-02-29')->'payments'->0->>'note', '日本語,"改行' || chr(10) || 'メモ', 'メモ値を損なわない');
select is((public.export_payments((select book_id from export_fixture), '2026-01-01', '2026-12-31')->>'count')::int, 0, '通常の最大1年を許可し0件を返す');
select throws_ok(format('select public.export_payments(%s, %L, %L)', (select book_id from export_fixture), '2026-01-01', '2027-01-01'), '22023', 'Shorten payment export period to at most one year', '通常年の1日超過を拒否');
select throws_ok(format('select public.export_payments(%s, %L, %L)', (select book_id from export_fixture), '2024-02-29', '2025-03-01'), '22023', 'Shorten payment export period to at most one year', 'うるう日開始の1日超過を拒否');
select throws_ok(format('select public.export_payments(%s, %L, %L)', (select book_id from export_fixture), '2024-03-01', '2024-02-29'), '22023', 'Invalid payment export period', '逆転を拒否');
select throws_ok(format('select public.export_payments(%s, null, %L)', (select book_id from export_fixture), '2024-02-29'), '22023', 'Invalid payment export period', '未入力を拒否');
select is(public.export_payments((select id from export_other_fixture), '2024-02-29', '2024-02-29'), '{"count":0,"payments":[]}'::jsonb, '指定Book以外の支払いを返さない');
reset role;
select set_config('request.jwt.claims', '{"sub":"16460000-0000-0000-0000-000000000001","email":"export-payments@example.com"}', true);
insert into public.payments(book_id,date,amount)
select book_id, '2026-01-01', n from export_fixture cross join generate_series(1,10000) n;
set local role authenticated;
select is((public.export_payments((select book_id from export_fixture), '2026-01-01', '2026-12-31')->>'count')::int, 10000, '10000件を許可');
select is(jsonb_array_length(public.export_payments((select book_id from export_fixture), '2026-01-01', '2026-12-31')->'payments'), 10000, '10000件を単一JSONで省略せず返す');
reset role;
insert into public.payments(book_id,date,amount) select book_id, '2026-01-01', 10001 from export_fixture;
set local role authenticated;
select is(public.export_payments((select book_id from export_fixture), '2026-01-01', '2026-12-31'), '{"count":10001,"payments":[]}'::jsonb, '10001件以上は一部データも返さない');
reset role;
create temp table export_category_fixture as select public.create_category_with_pin_and_budget('出力カテゴリ', false, '2023-01-01') as id;
grant select on export_category_fixture to authenticated;
insert into public.payments(book_id,date,amount,category_id)
select book_id, '2023-03-01', 42, id from export_fixture cross join export_category_fixture;
set local role authenticated;
select is(public.export_payments((select book_id from export_fixture), '2023-03-01', '2023-03-01')->'payments'->0->'category'->>'name', '出力カテゴリ', '同じBookのカテゴリ名を返す');
reset role;

-- 挿入順と日付順を変え、同日内のid順と対象の完全性も照合する。
insert into public.payments(book_id,date,amount)
select book_id, d, 42 from export_fixture
cross join unnest(array['2022-03-03'::date, '2022-03-01', '2022-03-02', '2022-03-01']) d;
set local role authenticated;
select is(
  (select jsonb_agg(jsonb_build_object('id', value->'id', 'date', value->'date') order by ord)
   from jsonb_array_elements(public.export_payments((select book_id from export_fixture), '2022-03-01', '2022-03-03')->'payments') with ordinality as exported(value, ord)),
  (select jsonb_agg(jsonb_build_object('id', id, 'date', date) order by date, id)
   from public.payments where book_id = (select book_id from export_fixture) and date between '2022-03-01' and '2022-03-03'),
  '候補抽出の順序に依存せず対象全件を日付・id順で返す'
);
reset role;

-- 大幅超過時も件数は検出用の上限で止め、一部データを返さない。
insert into public.payments(book_id,date,amount)
select book_id, '2021-06-01', n from export_fixture cross join generate_series(1,100000) n;
set local role authenticated;
select is(public.export_payments((select book_id from export_fixture), '2021-01-01', '2021-12-31'), '{"count":10001,"payments":[]}'::jsonb, '10万件が同日に集中しても超過を拒否する');
reset role;
insert into public.payments(book_id,date,amount)
select book_id, '2020-01-01'::date + (n % 366), n from export_fixture cross join generate_series(1,100000) n;
set local role authenticated;
select is(public.export_payments((select book_id from export_fixture), '2020-01-01', '2020-12-31'), '{"count":10001,"payments":[]}'::jsonb, '10万件が期間内に分散しても超過を拒否する');
reset role;
select * from finish();
rollback;
