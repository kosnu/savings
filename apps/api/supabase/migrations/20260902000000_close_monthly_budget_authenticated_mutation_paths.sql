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
  authenticated_default_book_id := public.get_authenticated_default_book_id();
  effective_month_start := date_trunc('month', p_effective_month)::date;
  current_month_start := date_trunc('month', current_date)::date;

  if effective_month_start < current_month_start then
    raise exception 'Monthly budget month cannot be before current month.'
      using errcode = 'P0001';
  end if;

  select id, status
  into existing_budget_id, existing_status
  from public.monthly_budgets
  where book_id = authenticated_default_book_id
    and effective_year = extract(year from effective_month_start)::integer
    and effective_month = extract(month from effective_month_start)::integer;

  if found and existing_status = 'amount' then
    raise exception 'A monthly budget for this month already exists.'
      using errcode = '23505';
  end if;

  if found and existing_status = 'none' then
    update public.monthly_budgets
    set status = 'amount',
        amount = p_amount
    where id = existing_budget_id;

    return;
  end if;

  insert into public.monthly_budgets (book_id, effective_from, status, amount)
  values (authenticated_default_book_id, effective_month_start, 'amount', p_amount);
end;
$$ language plpgsql security definer set search_path = '';

revoke all on function public.create_monthly_budget(date, integer) from public;
revoke all on function public.create_monthly_budget(date, integer) from anon;
grant execute on function public.create_monthly_budget(date, integer) to authenticated;
grant execute on function public.create_monthly_budget(date, integer) to service_role;

revoke insert, update, delete on table public.monthly_budgets from authenticated;
