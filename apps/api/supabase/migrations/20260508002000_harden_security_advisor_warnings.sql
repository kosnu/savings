create or replace function public.get_monthly_total_amount(
    p_month text
)
returns numeric
language sql
stable
set search_path = public, pg_temp
as $$
    select coalesce(sum(p.amount), 0)
    from public.payments p
    where exists (
      select 1
      from public.book_members bm
      where bm.book_id = p.book_id
        and bm.user_id = public.get_authenticated_user_id()
    )
      and p.date >= to_date(p_month || '-01', 'YYYY-MM-DD')
      and p.date < (to_date(p_month || '-01', 'YYYY-MM-DD') + interval '1 month')::date;
$$;

revoke all on function public.get_monthly_total_amount(text) from public;
revoke all on function public.get_monthly_total_amount(text) from anon;
grant execute on function public.get_monthly_total_amount(text) to authenticated;
grant execute on function public.get_monthly_total_amount(text) to service_role;

revoke select on table public.users from anon;
revoke select on table public.books from anon;
revoke select on table public.book_members from anon;
revoke select on table public.categories from anon;
revoke select on table public.payments from anon;
revoke select on table public.monthly_budgets from anon;
revoke select on table public.category_budgets from anon;
revoke select on table public.category_pins from anon;
