drop function if exists public.update_current_monthly_budget(integer);
drop function if exists public.remove_current_monthly_budget();

create or replace function public.update_current_monthly_budget(
  p_monthly_budget_id bigint,
  p_amount integer
)
returns void as $$
declare
  authenticated_default_book_id bigint;
  current_month_start date;
  current_month_end date;
  effective_budget public.monthly_budgets%rowtype;
begin
  authenticated_default_book_id := public.get_authenticated_default_book_id();
  current_month_start := date_trunc('month', current_date)::date;
  current_month_end := (current_month_start + interval '1 month - 1 day')::date;

  select *
  into effective_budget
  from public.monthly_budgets
  where book_id = authenticated_default_book_id
    and effective_from <= current_month_end
  order by effective_from desc
  limit 1
  for update;

  if not found
    or effective_budget.status <> 'amount'
    or effective_budget.id is distinct from p_monthly_budget_id then
    raise exception 'Current monthly budget was not found.'
      using errcode = 'P0002';
  end if;

  if effective_budget.effective_from = current_month_start then
    update public.monthly_budgets
    set amount = p_amount
    where id = effective_budget.id;

    return;
  end if;

  insert into public.monthly_budgets (book_id, effective_from, status, amount)
  values (authenticated_default_book_id, current_month_start, 'amount', p_amount);
end;
$$ language plpgsql security definer set search_path = '';

revoke all on function public.update_current_monthly_budget(bigint, integer) from public;
revoke all on function public.update_current_monthly_budget(bigint, integer) from anon;
grant execute on function public.update_current_monthly_budget(bigint, integer) to authenticated;
grant execute on function public.update_current_monthly_budget(bigint, integer) to service_role;

create or replace function public.remove_current_monthly_budget(
  p_monthly_budget_id bigint
)
returns void as $$
declare
  authenticated_default_book_id bigint;
  current_month_start date;
  current_month_end date;
  effective_budget public.monthly_budgets%rowtype;
begin
  authenticated_default_book_id := public.get_authenticated_default_book_id();
  current_month_start := date_trunc('month', current_date)::date;
  current_month_end := (current_month_start + interval '1 month - 1 day')::date;

  select *
  into effective_budget
  from public.monthly_budgets
  where book_id = authenticated_default_book_id
    and effective_from <= current_month_end
  order by effective_from desc
  limit 1
  for update;

  if not found
    or effective_budget.status <> 'amount'
    or effective_budget.id is distinct from p_monthly_budget_id then
    raise exception 'Current monthly budget was not found.'
      using errcode = 'P0002';
  end if;

  if effective_budget.effective_from = current_month_start then
    update public.monthly_budgets
    set status = 'none',
        amount = null
    where id = effective_budget.id;

    return;
  end if;

  insert into public.monthly_budgets (book_id, effective_from, status, amount)
  values (authenticated_default_book_id, current_month_start, 'none', null);
end;
$$ language plpgsql security definer set search_path = '';

revoke all on function public.remove_current_monthly_budget(bigint) from public;
revoke all on function public.remove_current_monthly_budget(bigint) from anon;
grant execute on function public.remove_current_monthly_budget(bigint) to authenticated;
grant execute on function public.remove_current_monthly_budget(bigint) to service_role;
