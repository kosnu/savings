create or replace function public.update_category_name_for_settings(
  p_category_id bigint,
  p_category_name text
)
returns void as $$
declare
  updated_category_count integer;
begin
  update public.categories
  set name = p_category_name
  where categories.id = p_category_id;

  get diagnostics updated_category_count = row_count;

  if updated_category_count <> 1 then
    raise exception 'Category was not updated.'
      using errcode = 'P0002';
  end if;
end;
$$ language plpgsql security invoker set search_path = public;

revoke all on function public.update_category_name_for_settings(bigint, text) from public;
revoke all on function public.update_category_name_for_settings(bigint, text) from anon;
grant execute on function public.update_category_name_for_settings(bigint, text) to authenticated;
grant execute on function public.update_category_name_for_settings(bigint, text) to service_role;

create or replace function public.update_category_pin_for_settings(
  p_category_id bigint,
  p_pinned boolean
)
returns void as $$
declare
  authenticated_user_id bigint;
  has_pin boolean;
begin
  authenticated_user_id := public.get_authenticated_user_id();

  select exists (
    select 1
    from public.category_pins
    where user_id = authenticated_user_id
      and category_id = p_category_id
  )
  into has_pin;

  if p_pinned and not has_pin then
    insert into public.category_pins (category_id)
    values (p_category_id);
  end if;

  if not p_pinned and has_pin then
    delete from public.category_pins
    where user_id = authenticated_user_id
      and category_id = p_category_id;
  end if;
end;
$$ language plpgsql security invoker set search_path = public;

revoke all on function public.update_category_pin_for_settings(bigint, boolean) from public;
revoke all on function public.update_category_pin_for_settings(bigint, boolean) from anon;
grant execute on function public.update_category_pin_for_settings(bigint, boolean) to authenticated;
grant execute on function public.update_category_pin_for_settings(bigint, boolean) to service_role;
