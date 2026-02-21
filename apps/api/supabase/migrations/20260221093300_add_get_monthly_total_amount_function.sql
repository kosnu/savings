create or replace function public.get_monthly_total_amount(
    p_month text
)
returns numeric
language sql
stable
as $$
    select coalesce(sum(p.amount), 0)
    from public.payments
    inner join public.users u on u.id = p.user_id
    where u.external_id = auth.uid()::text
      and p.date >= to_date(p_month || '-01', 'YYYY-MM-DD')
      and p.date < (to_date(p_month || '-01', 'YYYY-MM-DD') + interval '1 month')::date;
$$;

revoke all on function public.get_monthly_total_amount(text) from public;
grant execute on function public.get_monthly_total_amount(text) to authenticated;
grant execute on function public.get_monthly_total_amount(text) to service_role;
