create or replace function create_category_with_budget(
  p_category_name text,
  p_budget_effective_from date default null,
  p_budget_amount integer default null
)
returns bigint as $$
declare
  authenticated_default_book_id bigint;
  created_category_id bigint;
begin
  if (p_budget_effective_from is null) <> (p_budget_amount is null) then
    raise exception 'Category budget requires both month and amount.'
      using errcode = '22023';
  end if;

  authenticated_default_book_id := get_authenticated_default_book_id();

  insert into categories (book_id, name)
  values (authenticated_default_book_id, p_category_name)
  returning id into created_category_id;

  if p_budget_effective_from is not null then
    insert into category_budgets (
      book_id,
      category_id,
      effective_from,
      amount
    )
    values (
      authenticated_default_book_id,
      created_category_id,
      p_budget_effective_from,
      p_budget_amount
    );
  end if;

  return created_category_id;
end;
$$ language plpgsql security invoker set search_path = public;

revoke all on function public.create_category_with_budget(text, date, integer) from public;
revoke all on function public.create_category_with_budget(text, date, integer) from anon;
grant execute on function public.create_category_with_budget(text, date, integer) to authenticated;
grant execute on function public.create_category_with_budget(text, date, integer) to service_role;
