-- users テーブル
alter table users enable row level security;

create policy "Users can read own row"
  on users for select
  to authenticated
  using (external_id = auth.uid()::text);

-- payments テーブル
alter table payments enable row level security;

create policy "Users can read own payments"
  on payments for select
  to authenticated
  using (user_id in (select id from users where external_id = auth.uid()::text));

create policy "Users can insert own payments"
  on payments for insert
  to authenticated
  with check (user_id in (select id from users where external_id = auth.uid()::text));

create policy "Users can update own payments"
  on payments for update
  to authenticated
  using (user_id in (select id from users where external_id = auth.uid()::text))
  with check (user_id in (select id from users where external_id = auth.uid()::text));

create policy "Users can delete own payments"
  on payments for delete
  to authenticated
  using (user_id in (select id from users where external_id = auth.uid()::text));

-- categories テーブル
alter table categories enable row level security;

create policy "Authenticated users can read all categories"
  on categories for select
  to authenticated
  using (true);
