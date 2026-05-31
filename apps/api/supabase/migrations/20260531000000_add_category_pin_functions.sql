create or replace function create_category_with_pin(
  p_category_name text,
  p_pinned boolean
)
returns bigint as $$
declare
  authenticated_default_book_id bigint;
  created_category_id bigint;
begin
  authenticated_default_book_id := get_authenticated_default_book_id();

  insert into categories (book_id, name)
  values (authenticated_default_book_id, p_category_name)
  returning id into created_category_id;

  if p_pinned then
    insert into category_pins (category_id)
    values (created_category_id);
  end if;

  return created_category_id;
end;
$$ language plpgsql security invoker set search_path = public;

revoke all on function public.create_category_with_pin(text, boolean) from public;
revoke all on function public.create_category_with_pin(text, boolean) from anon;
grant execute on function public.create_category_with_pin(text, boolean) to authenticated;
grant execute on function public.create_category_with_pin(text, boolean) to service_role;

create or replace function update_category_with_pin(
  p_category_id bigint,
  p_category_name text,
  p_pinned boolean
)
returns void as $$
declare
  authenticated_user_id bigint;
  updated_category_count integer;
  has_pin boolean;
begin
  authenticated_user_id := get_authenticated_user_id();

  update categories
  set name = p_category_name
  where categories.id = p_category_id;

  get diagnostics updated_category_count = row_count;

  if updated_category_count <> 1 then
    raise exception 'Category was not updated.'
      using errcode = 'P0002';
  end if;

  select exists (
    select 1
    from category_pins
    where user_id = authenticated_user_id
      and category_id = p_category_id
  )
  into has_pin;

  if p_pinned and not has_pin then
    insert into category_pins (category_id)
    values (p_category_id);
  end if;

  if not p_pinned and has_pin then
    delete from category_pins
    where user_id = authenticated_user_id
      and category_id = p_category_id;
  end if;
end;
$$ language plpgsql security invoker set search_path = public;

revoke all on function public.update_category_with_pin(bigint, text, boolean) from public;
revoke all on function public.update_category_with_pin(bigint, text, boolean) from anon;
grant execute on function public.update_category_with_pin(bigint, text, boolean) to authenticated;
grant execute on function public.update_category_with_pin(bigint, text, boolean) to service_role;
