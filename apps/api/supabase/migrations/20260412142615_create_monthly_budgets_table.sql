create or replace function get_authenticated_user_id()
returns bigint as $$
declare
  authenticated_user_id bigint;
begin
  select id into authenticated_user_id
  from users
  where external_id = auth.uid()::text;

  if authenticated_user_id is null then
    raise exception 'User not found for auth.uid: %', auth.uid();
  end if;

  return authenticated_user_id;
end;
$$ language plpgsql security invoker stable set search_path = public;

revoke all on function public.get_authenticated_user_id() from public;
revoke all on function public.get_authenticated_user_id() from anon;
grant execute on function public.get_authenticated_user_id() to authenticated;
grant execute on function public.get_authenticated_user_id() to service_role;

create table monthly_budgets (
    id bigint generated always as identity primary key,
    effective_from date not null,
    effective_year integer generated always as (extract(year from effective_from)::integer) stored not null,
    effective_month integer generated always as (extract(month from effective_from)::integer) stored not null,
    amount numeric(10, 2) not null,
    created_at timestamp with time zone default current_timestamp,
    updated_at timestamp with time zone default current_timestamp,

    user_id bigint not null default get_authenticated_user_id() references users(id) on delete cascade,

    constraint monthly_budgets_user_effective_year_month_key
        unique (user_id, effective_year, effective_month)
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
  new.user_id := get_authenticated_user_id();
  return new;
end;
$$ language plpgsql security invoker set search_path = public;

create trigger trg_set_monthly_budget_user_id
  before insert on monthly_budgets
  for each row
  execute function set_monthly_budget_user_id();
