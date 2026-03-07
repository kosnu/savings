create or replace function set_payment_user_id()
returns trigger as $$
begin
  new.user_id := (select id from users where external_id = auth.uid()::text);
  if new.user_id is null then
    raise exception 'User not found for auth.uid: %', auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security invoker set search_path = public;

create trigger trg_set_payment_user_id
  before insert on payments
  for each row
  execute function set_payment_user_id();
