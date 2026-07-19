begin;

create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(2);

insert into auth.users (id, email)
values ('10000000-0000-0000-0000-000000000001', 'new-user@example.com');

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '10000000-0000-0000-0000-000000000001',
    'email', 'new-user@example.com'
  )::text,
  true
);
set local role authenticated;
select public.ensure_authenticated_user('Application Supplied Name');
reset role;

select is(
  (select name from public.users where email = 'new-user@example.com'),
  'Application Supplied Name',
  'アプリケーションから渡された初期表示名をそのまま登録する'
);

set local role authenticated;
select public.ensure_authenticated_user('Different Name');
reset role;

select is(
  (select name from public.users where email = 'new-user@example.com'),
  'Application Supplied Name',
  '登録済みユーザーの表示名を再実行で変更しない'
);

select * from finish();
rollback;
