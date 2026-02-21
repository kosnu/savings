create or replace function public.get_monthly_total_amount(
    p_user_id bigint,
    p_month text
)
returns numeric
language sql
stable
as $$
    select coalesce(sum(amount), 0)
    from public.payments
    where user_id = p_user_id
      and date >= to_date(p_month || '-01', 'YYYY-MM-DD')
      and date < (to_date(p_month || '-01', 'YYYY-MM-DD') + interval '1 month')::date;
$$;
