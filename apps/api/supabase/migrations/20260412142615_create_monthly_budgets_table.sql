create table monthly_budgets (
    id bigint generated always as identity primary key,
    effective_from date not null,
    amount numeric(10, 2) not null,
    created_at timestamp with time zone default current_timestamp,
    updated_at timestamp with time zone default current_timestamp,

    user_id bigint not null references users(id) on delete cascade
);

create unique index uniq_monthly_budgets_user_effective_year_month
    on monthly_budgets (
        user_id,
        extract(year from effective_from),
        extract(month from effective_from)
    );

create index idx_monthly_budgets_user_effective_from
    on monthly_budgets (user_id, effective_from desc);

alter table monthly_budgets enable row level security;

create policy "Users can read own monthly budgets"
  on monthly_budgets for select
  to authenticated
  using (user_id in (select id from users where external_id = auth.uid()::text));

create policy "Users can insert own monthly budgets"
  on monthly_budgets for insert
  to authenticated
  with check (user_id in (select id from users where external_id = auth.uid()::text));

create or replace function set_monthly_budget_user_id()
returns trigger as $$
begin
  new.user_id := (select id from users where external_id = auth.uid()::text);
  if new.user_id is null then
    raise exception 'User not found for auth.uid: %', auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security invoker set search_path = public;

create trigger trg_set_monthly_budget_user_id
  before insert on monthly_budgets
  for each row
  execute function set_monthly_budget_user_id();
