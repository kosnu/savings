alter table monthly_budgets
  add column status text not null default 'amount';

alter table monthly_budgets
  alter column amount drop not null;

alter table monthly_budgets
  add constraint monthly_budgets_status_check
    check (status in ('amount', 'none')),
  add constraint monthly_budgets_status_amount_check
    check (
      (status = 'amount' and amount is not null)
      or (status = 'none' and amount is null)
    );

create or replace function public.get_effective_monthly_budget(
  p_target_month date
)
returns jsonb as $$
declare
  authenticated_default_book_id bigint;
  target_month_end date;
  budget_row monthly_budgets%rowtype;
begin
  authenticated_default_book_id := get_authenticated_default_book_id();
  target_month_end := (date_trunc('month', p_target_month)::date + interval '1 month - 1 day')::date;

  select *
  into budget_row
  from monthly_budgets
  where book_id = authenticated_default_book_id
    and effective_from <= target_month_end
  order by effective_from desc
  limit 1;

  if not found then
    return jsonb_build_object('status', 'unset', 'monthly_budget', null);
  end if;

  if budget_row.status = 'none' then
    return jsonb_build_object('status', 'none', 'monthly_budget', null);
  end if;

  return jsonb_build_object(
    'status', 'amount',
    'monthly_budget', jsonb_build_object(
      'id', budget_row.id,
      'book_id', budget_row.book_id,
      'amount', budget_row.amount,
      'effective_from', budget_row.effective_from,
      'effective_year', budget_row.effective_year,
      'effective_month', budget_row.effective_month,
      'status', budget_row.status,
      'created_at', budget_row.created_at,
      'updated_at', budget_row.updated_at
    )
  );
end;
$$ language plpgsql security invoker stable set search_path = public;

revoke all on function public.get_effective_monthly_budget(date) from public;
revoke all on function public.get_effective_monthly_budget(date) from anon;
grant execute on function public.get_effective_monthly_budget(date) to authenticated;
grant execute on function public.get_effective_monthly_budget(date) to service_role;

create or replace function public.create_monthly_budget(
  p_effective_month date,
  p_amount integer
)
returns void as $$
declare
  authenticated_default_book_id bigint;
  effective_month_start date;
  current_month_start date;
  existing_budget_id bigint;
  existing_status text;
begin
  authenticated_default_book_id := get_authenticated_default_book_id();
  effective_month_start := date_trunc('month', p_effective_month)::date;
  current_month_start := date_trunc('month', current_date)::date;

  if effective_month_start < current_month_start then
    raise exception 'Monthly budget month cannot be before current month.'
      using errcode = 'P0001';
  end if;

  select id, status
  into existing_budget_id, existing_status
  from monthly_budgets
  where book_id = authenticated_default_book_id
    and effective_year = extract(year from effective_month_start)::integer
    and effective_month = extract(month from effective_month_start)::integer;

  if found and existing_status = 'amount' then
    raise exception 'A monthly budget for this month already exists.'
      using errcode = '23505';
  end if;

  if found and existing_status = 'none' then
    update monthly_budgets
    set status = 'amount',
        amount = p_amount
    where id = existing_budget_id;

    return;
  end if;

  insert into monthly_budgets (book_id, effective_from, status, amount)
  values (authenticated_default_book_id, effective_month_start, 'amount', p_amount);
end;
$$ language plpgsql security invoker set search_path = public;

revoke all on function public.create_monthly_budget(date, integer) from public;
revoke all on function public.create_monthly_budget(date, integer) from anon;
grant execute on function public.create_monthly_budget(date, integer) to authenticated;
grant execute on function public.create_monthly_budget(date, integer) to service_role;

create or replace function public.update_current_monthly_budget(
  p_amount integer
)
returns void as $$
declare
  authenticated_default_book_id bigint;
  current_month_start date;
  current_year integer;
  current_month integer;
  effective_budget monthly_budgets%rowtype;
begin
  authenticated_default_book_id := get_authenticated_default_book_id();
  current_month_start := date_trunc('month', current_date)::date;
  current_year := extract(year from current_month_start)::integer;
  current_month := extract(month from current_month_start)::integer;

  select *
  into effective_budget
  from monthly_budgets
  where book_id = authenticated_default_book_id
    and effective_from <= (current_month_start + interval '1 month - 1 day')::date
  order by effective_from desc
  limit 1;

  if not found or effective_budget.status <> 'amount' then
    raise exception 'Current monthly budget was not found.'
      using errcode = 'P0002';
  end if;

  if effective_budget.effective_year = current_year and effective_budget.effective_month = current_month then
    update monthly_budgets
    set amount = p_amount
    where id = effective_budget.id;

    return;
  end if;

  insert into monthly_budgets (book_id, effective_from, status, amount)
  values (authenticated_default_book_id, current_month_start, 'amount', p_amount);
end;
$$ language plpgsql security invoker set search_path = public;

revoke all on function public.update_current_monthly_budget(integer) from public;
revoke all on function public.update_current_monthly_budget(integer) from anon;
grant execute on function public.update_current_monthly_budget(integer) to authenticated;
grant execute on function public.update_current_monthly_budget(integer) to service_role;

create or replace function public.remove_current_monthly_budget()
returns void as $$
declare
  authenticated_default_book_id bigint;
  current_month_start date;
  current_year integer;
  current_month integer;
  effective_budget monthly_budgets%rowtype;
begin
  authenticated_default_book_id := get_authenticated_default_book_id();
  current_month_start := date_trunc('month', current_date)::date;
  current_year := extract(year from current_month_start)::integer;
  current_month := extract(month from current_month_start)::integer;

  select *
  into effective_budget
  from monthly_budgets
  where book_id = authenticated_default_book_id
    and effective_from <= (current_month_start + interval '1 month - 1 day')::date
  order by effective_from desc
  limit 1;

  if not found or effective_budget.status <> 'amount' then
    raise exception 'Current monthly budget was not found.'
      using errcode = 'P0002';
  end if;

  if effective_budget.effective_year = current_year and effective_budget.effective_month = current_month then
    update monthly_budgets
    set status = 'none',
        amount = null
    where id = effective_budget.id;

    return;
  end if;

  insert into monthly_budgets (book_id, effective_from, status, amount)
  values (authenticated_default_book_id, current_month_start, 'none', null);
end;
$$ language plpgsql security invoker set search_path = public;

revoke all on function public.remove_current_monthly_budget() from public;
revoke all on function public.remove_current_monthly_budget() from anon;
grant execute on function public.remove_current_monthly_budget() to authenticated;
grant execute on function public.remove_current_monthly_budget() to service_role;
