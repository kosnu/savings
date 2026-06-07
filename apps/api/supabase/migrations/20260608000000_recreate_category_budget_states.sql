create table public.category_budgets (
  id bigint generated always as identity primary key,
  book_id bigint not null references public.books(id) on delete cascade,
  category_id bigint not null references public.categories(id) on delete cascade,
  effective_from date not null,
  effective_year integer generated always as (extract(year from effective_from)::integer) stored,
  effective_month integer generated always as (extract(month from effective_from)::integer) stored,
  status text not null default 'amount',
  amount integer,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint category_budgets_book_category_effective_year_month_key
    unique (book_id, category_id, effective_year, effective_month),
  constraint category_budgets_status_check
    check (status in ('amount', 'none')),
  constraint category_budgets_status_amount_check
    check (
      (status = 'amount' and amount is not null and amount >= 0)
      or (status = 'none' and amount is null)
    )
);

create index idx_category_budgets_book_category_effective_from
  on public.category_budgets (book_id, category_id, effective_from desc);

alter table public.category_budgets enable row level security;

create policy "Book members can read category budgets"
  on public.category_budgets for select
  using (
    exists (
      select 1
      from public.book_members
      where book_members.book_id = category_budgets.book_id
        and book_members.user_id = public.get_authenticated_user_id()
    )
  );

create policy "Book members can insert category budgets"
  on public.category_budgets for insert
  with check (
    exists (
      select 1
      from public.book_members
      where book_members.book_id = category_budgets.book_id
        and book_members.user_id = public.get_authenticated_user_id()
    )
    and exists (
      select 1
      from public.categories
      where categories.id = category_budgets.category_id
        and categories.book_id = category_budgets.book_id
    )
  );

create policy "Book members can update category budgets"
  on public.category_budgets for update
  using (
    exists (
      select 1
      from public.book_members
      where book_members.book_id = category_budgets.book_id
        and book_members.user_id = public.get_authenticated_user_id()
    )
  )
  with check (
    exists (
      select 1
      from public.book_members
      where book_members.book_id = category_budgets.book_id
        and book_members.user_id = public.get_authenticated_user_id()
    )
    and exists (
      select 1
      from public.categories
      where categories.id = category_budgets.category_id
        and categories.book_id = category_budgets.book_id
    )
  );

create or replace function public.update_category_budget_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security invoker set search_path = public;

create trigger trg_update_category_budget_updated_at
  before update on public.category_budgets
  for each row
  execute function public.update_category_budget_updated_at();

create or replace function public.set_current_category_budget_state(
  p_book_id bigint,
  p_category_id bigint,
  p_budget_status text,
  p_budget_amount integer default null
)
returns void as $$
declare
  current_month_start date;
begin
  if p_budget_status = 'unchanged' then
    return;
  end if;

  if p_budget_status not in ('amount', 'none') then
    raise exception 'Invalid category budget status.'
      using errcode = 'P0001';
  end if;

  if p_budget_status = 'amount' and p_budget_amount is null then
    raise exception 'Category budget amount is required.'
      using errcode = 'P0001';
  end if;

  if p_budget_status = 'none' and p_budget_amount is not null then
    raise exception 'Category budget amount must be null for none.'
      using errcode = 'P0001';
  end if;

  current_month_start := date_trunc('month', current_date)::date;

  insert into public.category_budgets (
    book_id,
    category_id,
    effective_from,
    status,
    amount
  )
  values (
    p_book_id,
    p_category_id,
    current_month_start,
    p_budget_status,
    case when p_budget_status = 'amount' then p_budget_amount else null end
  )
  on conflict (book_id, category_id, effective_year, effective_month)
  do update
  set status = excluded.status,
      amount = excluded.amount;
end;
$$ language plpgsql security invoker set search_path = public;

revoke all on function public.set_current_category_budget_state(bigint, bigint, text, integer) from public;
revoke all on function public.set_current_category_budget_state(bigint, bigint, text, integer) from anon;
grant execute on function public.set_current_category_budget_state(bigint, bigint, text, integer) to authenticated;
grant execute on function public.set_current_category_budget_state(bigint, bigint, text, integer) to service_role;

create or replace function public.create_category_with_settings(
  p_category_name text,
  p_pinned boolean,
  p_budget_amount integer default null
)
returns bigint as $$
declare
  authenticated_default_book_id bigint;
  created_category_id bigint;
begin
  authenticated_default_book_id := public.get_authenticated_default_book_id();

  insert into public.categories (book_id, name)
  values (authenticated_default_book_id, p_category_name)
  returning id into created_category_id;

  if p_pinned then
    insert into public.category_pins (category_id)
    values (created_category_id);
  end if;

  if p_budget_amount is not null then
    perform public.set_current_category_budget_state(
      authenticated_default_book_id,
      created_category_id,
      'amount',
      p_budget_amount
    );
  end if;

  return created_category_id;
end;
$$ language plpgsql security invoker set search_path = public;

revoke all on function public.create_category_with_settings(text, boolean, integer) from public;
revoke all on function public.create_category_with_settings(text, boolean, integer) from anon;
grant execute on function public.create_category_with_settings(text, boolean, integer) to authenticated;
grant execute on function public.create_category_with_settings(text, boolean, integer) to service_role;

create or replace function public.update_category_with_settings(
  p_category_id bigint,
  p_category_name text,
  p_pinned boolean,
  p_budget_status text,
  p_budget_amount integer default null
)
returns void as $$
declare
  authenticated_user_id bigint;
  category_book_id bigint;
  updated_category_count integer;
  has_pin boolean;
begin
  authenticated_user_id := public.get_authenticated_user_id();

  update public.categories
  set name = p_category_name
  where categories.id = p_category_id
  returning book_id into category_book_id;

  get diagnostics updated_category_count = row_count;

  if updated_category_count <> 1 then
    raise exception 'Category was not updated.'
      using errcode = 'P0002';
  end if;

  select exists (
    select 1
    from public.category_pins
    where user_id = authenticated_user_id
      and category_id = p_category_id
  )
  into has_pin;

  if p_pinned and not has_pin then
    insert into public.category_pins (category_id)
    values (p_category_id);
  end if;

  if not p_pinned and has_pin then
    delete from public.category_pins
    where user_id = authenticated_user_id
      and category_id = p_category_id;
  end if;

  perform public.set_current_category_budget_state(
    category_book_id,
    p_category_id,
    p_budget_status,
    p_budget_amount
  );
end;
$$ language plpgsql security invoker set search_path = public;

revoke all on function public.update_category_with_settings(bigint, text, boolean, text, integer) from public;
revoke all on function public.update_category_with_settings(bigint, text, boolean, text, integer) from anon;
grant execute on function public.update_category_with_settings(bigint, text, boolean, text, integer) to authenticated;
grant execute on function public.update_category_with_settings(bigint, text, boolean, text, integer) to service_role;

create or replace function public.list_category_settings_items()
returns jsonb as $$
declare
  authenticated_default_book_id bigint;
  current_month_end date;
begin
  authenticated_default_book_id := public.get_authenticated_default_book_id();
  current_month_end := (date_trunc('month', current_date)::date + interval '1 month - 1 day')::date;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', categories.id,
          'book_id', categories.book_id,
          'name', categories.name,
          'pinned', category_pins.id is not null,
          'budget_state', coalesce(effective_budget.status, 'unset'),
          'budget_amount', case when effective_budget.status = 'amount' then effective_budget.amount else null end
        )
        order by categories.id
      )
      from public.categories
      left join public.category_pins
        on category_pins.category_id = categories.id
       and category_pins.user_id = public.get_authenticated_user_id()
      left join lateral (
        select category_budgets.status, category_budgets.amount
        from public.category_budgets
        where category_budgets.book_id = categories.book_id
          and category_budgets.category_id = categories.id
          and category_budgets.effective_from <= current_month_end
        order by category_budgets.effective_from desc
        limit 1
      ) effective_budget on true
      where categories.book_id = authenticated_default_book_id
    ),
    '[]'::jsonb
  );
end;
$$ language plpgsql security invoker stable set search_path = public;

revoke all on function public.list_category_settings_items() from public;
revoke all on function public.list_category_settings_items() from anon;
grant execute on function public.list_category_settings_items() to authenticated;
grant execute on function public.list_category_settings_items() to service_role;

create or replace function public.get_category_totals_with_budgets(
  p_start_date date,
  p_end_date date
)
returns jsonb as $$
declare
  authenticated_default_book_id bigint;
  target_month_end date;
begin
  authenticated_default_book_id := public.get_authenticated_default_book_id();
  target_month_end := (date_trunc('month', p_start_date)::date + interval '1 month - 1 day')::date;

  return coalesce(
    (
      with category_totals as (
        select
          categories.id as category_id,
          categories.name as category_name,
          coalesce(sum(payments.amount), 0)::integer as total_amount,
          category_pins.id is not null as pinned,
          coalesce(effective_budget.status, 'unset') as budget_state,
          case when effective_budget.status = 'amount' then effective_budget.amount else null end as budget_amount
        from public.categories
        left join public.payments
          on payments.category_id = categories.id
         and payments.book_id = authenticated_default_book_id
         and payments.date >= p_start_date
         and payments.date <= p_end_date
        left join public.category_pins
          on category_pins.category_id = categories.id
         and category_pins.user_id = public.get_authenticated_user_id()
        left join lateral (
          select category_budgets.status, category_budgets.amount
          from public.category_budgets
          where category_budgets.book_id = categories.book_id
            and category_budgets.category_id = categories.id
            and category_budgets.effective_from <= target_month_end
          order by category_budgets.effective_from desc
          limit 1
        ) effective_budget on true
        where categories.book_id = authenticated_default_book_id
        group by categories.id, categories.name, category_pins.id, effective_budget.status, effective_budget.amount
      ),
      uncategorized_total as (
        select
          null::bigint as category_id,
          'Unknown'::text as category_name,
          coalesce(sum(payments.amount), 0)::integer as total_amount,
          false as pinned,
          'unset'::text as budget_state,
          null::integer as budget_amount
        from public.payments
        where payments.book_id = authenticated_default_book_id
          and payments.category_id is null
          and payments.date >= p_start_date
          and payments.date <= p_end_date
      ),
      rows as (
        select *, 'category'::text as kind from category_totals
        union all
        select *, 'uncategorized'::text as kind from uncategorized_total
      )
      select jsonb_agg(
        jsonb_build_object(
          'category_id', rows.category_id,
          'category_name', rows.category_name,
          'total_amount', rows.total_amount,
          'pinned', rows.pinned,
          'budget_state', rows.budget_state,
          'budget_amount', rows.budget_amount,
          'kind', rows.kind
        )
        order by rows.pinned desc, rows.category_id nulls last
      )
      from rows
    ),
    '[]'::jsonb
  );
end;
$$ language plpgsql security invoker stable set search_path = public;

revoke all on function public.get_category_totals_with_budgets(date, date) from public;
revoke all on function public.get_category_totals_with_budgets(date, date) from anon;
grant execute on function public.get_category_totals_with_budgets(date, date) to authenticated;
grant execute on function public.get_category_totals_with_budgets(date, date) to service_role;
