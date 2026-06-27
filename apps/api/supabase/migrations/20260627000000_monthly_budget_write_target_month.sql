drop function if exists public.update_current_monthly_budget(integer);
drop function if exists public.remove_current_monthly_budget();

create or replace function public.update_current_monthly_budget(
  p_target_month date,
  p_amount integer
)
returns void as $$
declare
  authenticated_default_book_id bigint;
  target_month_start date;
  current_month_start date;
  target_year integer;
  target_month integer;
  effective_budget monthly_budgets%rowtype;
begin
  authenticated_default_book_id := get_authenticated_default_book_id();
  target_month_start := date_trunc('month', p_target_month)::date;
  current_month_start := date_trunc('month', current_date)::date;
  target_year := extract(year from target_month_start)::integer;
  target_month := extract(month from target_month_start)::integer;

  if target_month_start < current_month_start then
    raise exception 'Monthly budget month cannot be before current month.'
      using errcode = 'P0001';
  end if;

  select *
  into effective_budget
  from monthly_budgets
  where book_id = authenticated_default_book_id
    and effective_from <= (target_month_start + interval '1 month - 1 day')::date
  order by effective_from desc
  limit 1;

  if not found or effective_budget.status <> 'amount' then
    raise exception 'Current monthly budget was not found.'
      using errcode = 'P0002';
  end if;

  if effective_budget.effective_year = target_year and effective_budget.effective_month = target_month then
    update monthly_budgets
    set amount = p_amount
    where id = effective_budget.id;

    return;
  end if;

  insert into monthly_budgets (book_id, effective_from, status, amount)
  values (authenticated_default_book_id, target_month_start, 'amount', p_amount);
end;
$$ language plpgsql security invoker set search_path = public;

revoke all on function public.update_current_monthly_budget(date, integer) from public;
revoke all on function public.update_current_monthly_budget(date, integer) from anon;
grant execute on function public.update_current_monthly_budget(date, integer) to authenticated;
grant execute on function public.update_current_monthly_budget(date, integer) to service_role;

create or replace function public.remove_current_monthly_budget(
  p_target_month date
)
returns void as $$
declare
  authenticated_default_book_id bigint;
  target_month_start date;
  current_month_start date;
  target_year integer;
  target_month integer;
  effective_budget monthly_budgets%rowtype;
begin
  authenticated_default_book_id := get_authenticated_default_book_id();
  target_month_start := date_trunc('month', p_target_month)::date;
  current_month_start := date_trunc('month', current_date)::date;
  target_year := extract(year from target_month_start)::integer;
  target_month := extract(month from target_month_start)::integer;

  if target_month_start < current_month_start then
    raise exception 'Monthly budget month cannot be before current month.'
      using errcode = 'P0001';
  end if;

  select *
  into effective_budget
  from monthly_budgets
  where book_id = authenticated_default_book_id
    and effective_from <= (target_month_start + interval '1 month - 1 day')::date
  order by effective_from desc
  limit 1;

  if not found or effective_budget.status <> 'amount' then
    raise exception 'Current monthly budget was not found.'
      using errcode = 'P0002';
  end if;

  if effective_budget.effective_year = target_year and effective_budget.effective_month = target_month then
    update monthly_budgets
    set status = 'none',
        amount = null
    where id = effective_budget.id;

    return;
  end if;

  insert into monthly_budgets (book_id, effective_from, status, amount)
  values (authenticated_default_book_id, target_month_start, 'none', null);
end;
$$ language plpgsql security invoker set search_path = public;

revoke all on function public.remove_current_monthly_budget(date) from public;
revoke all on function public.remove_current_monthly_budget(date) from anon;
grant execute on function public.remove_current_monthly_budget(date) to authenticated;
grant execute on function public.remove_current_monthly_budget(date) to service_role;
