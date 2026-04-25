create table category_budgets (
    id bigint generated always as identity primary key,
    category_id bigint not null references categories(id) on delete restrict,
    effective_from date not null,
    effective_year integer generated always as (extract(year from effective_from)::integer) stored not null,
    effective_month integer generated always as (extract(month from effective_from)::integer) stored not null,
    amount numeric(10, 2) not null,
    created_at timestamp with time zone default current_timestamp,
    updated_at timestamp with time zone default current_timestamp,

    user_id bigint not null default get_authenticated_user_id() references users(id) on delete cascade,

    constraint category_budgets_user_category_effective_year_month_key
        unique (user_id, category_id, effective_year, effective_month)
);

create index idx_category_budgets_user_category_effective_from
    on category_budgets (user_id, category_id, effective_from desc);

alter table category_budgets enable row level security;

create policy "Users can read own category budgets"
  on category_budgets for select
  to authenticated
  using (user_id in (select id from users where external_id = auth.uid()::text));

create policy "Users can insert own category budgets"
  on category_budgets for insert
  to authenticated
  with check (user_id in (select id from users where external_id = auth.uid()::text));

create or replace function set_category_budget_user_id()
returns trigger as $$
begin
  new.user_id := get_authenticated_user_id();
  return new;
end;
$$ language plpgsql security invoker set search_path = public;

create trigger trg_set_category_budget_user_id
  before insert on category_budgets
  for each row
  execute function set_category_budget_user_id();
