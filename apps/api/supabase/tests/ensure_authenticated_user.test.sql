begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(2);

insert into auth.users (id, email)
values
  ('10000000-0000-0000-0000-000000000001', 'at-limit@example.com'),
  ('10000000-0000-0000-0000-000000000002', 'over-limit@example.com');

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '10000000-0000-0000-0000-000000000001',
    'email', 'at-limit@example.com',
    'user_metadata', json_build_object('name', repeat('a', 64))
  )::text,
  true
);
set local role authenticated;
select public.ensure_authenticated_user();
reset role;

select is(
  (select name from public.users where email = 'at-limit@example.com'),
  repeat('a', 64),
  '64文字の初期表示名をそのまま登録する'
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '10000000-0000-0000-0000-000000000002',
    'email', 'over-limit@example.com',
    'user_metadata', json_build_object('name', repeat('b', 65))
  )::text,
  true
);
set local role authenticated;
select public.ensure_authenticated_user();
reset role;

select is(
  (select name from public.users where email = 'over-limit@example.com'),
  repeat('b', 64),
  '65文字の初期表示名を先頭64文字で登録する'
);

select * from finish();
rollback;
