alter table payments
  alter column user_id set default get_authenticated_user_id();

create or replace function set_payment_user_id()
returns trigger as $$
begin
  new.user_id := get_authenticated_user_id();
  return new;
end;
$$ language plpgsql security invoker set search_path = public;
