alter table payments
  add column book_id bigint references books(id) on delete cascade;

update payments
set book_id = book_members.book_id
from book_members
where book_members.user_id = payments.user_id
  and book_members.is_default;

do $$
begin
  if exists (select 1 from payments where book_id is null) then
    raise exception 'Default book is missing for existing payments.';
  end if;
end $$;

create or replace function get_authenticated_default_book_id()
returns bigint as $$
declare
  authenticated_default_book_id bigint;
begin
  select book_members.book_id into authenticated_default_book_id
  from book_members
  where book_members.user_id = get_authenticated_user_id()
    and book_members.is_default;

  if authenticated_default_book_id is null then
    raise exception 'Default book not found for auth.uid: %', auth.uid();
  end if;

  return authenticated_default_book_id;
end;
$$ language plpgsql security invoker stable set search_path = public;

revoke all on function public.get_authenticated_default_book_id() from public;
revoke all on function public.get_authenticated_default_book_id() from anon;
grant execute on function public.get_authenticated_default_book_id() to authenticated;
grant execute on function public.get_authenticated_default_book_id() to service_role;

alter table payments
  alter column book_id set not null,
  alter column book_id set default get_authenticated_default_book_id();

create index idx_payments_book_date_category_created
    on payments (book_id, date, category_id, created_at);

drop trigger if exists trg_set_payment_user_id on payments;
drop function if exists set_payment_user_id();

create or replace function set_payment_ownership()
returns trigger as $$
begin
  new.user_id := get_authenticated_user_id();

  if new.book_id is null then
    new.book_id := get_authenticated_default_book_id();
  end if;

  return new;
end;
$$ language plpgsql security invoker set search_path = public;

create trigger trg_set_payment_ownership
  before insert on payments
  for each row
  execute function set_payment_ownership();

create or replace function keep_payment_book_id()
returns trigger as $$
begin
  new.book_id := old.book_id;
  return new;
end;
$$ language plpgsql security invoker set search_path = public;

create trigger trg_keep_payment_book_id
  before update on payments
  for each row
  execute function keep_payment_book_id();

drop policy "Users can read own payments" on payments;
drop policy "Users can insert own payments" on payments;
drop policy "Users can update own payments" on payments;
drop policy "Users can delete own payments" on payments;

create policy "Users can read member book payments"
  on payments for select
  to authenticated
  using (
    exists (
      select 1
      from book_members
      where book_members.book_id = payments.book_id
        and book_members.user_id = get_authenticated_user_id()
    )
  );

create policy "Users can insert member book payments"
  on payments for insert
  to authenticated
  with check (
    exists (
      select 1
      from book_members
      where book_members.book_id = payments.book_id
        and book_members.user_id = get_authenticated_user_id()
    )
  );

create policy "Users can update member book payments"
  on payments for update
  to authenticated
  using (
    exists (
      select 1
      from book_members
      where book_members.book_id = payments.book_id
        and book_members.user_id = get_authenticated_user_id()
    )
  )
  with check (
    exists (
      select 1
      from book_members
      where book_members.book_id = payments.book_id
        and book_members.user_id = get_authenticated_user_id()
    )
  );

create policy "Users can delete member book payments"
  on payments for delete
  to authenticated
  using (
    exists (
      select 1
      from book_members
      where book_members.book_id = payments.book_id
        and book_members.user_id = get_authenticated_user_id()
    )
  );

create or replace function public.get_monthly_total_amount(
    p_month text
)
returns numeric
language sql
stable
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
