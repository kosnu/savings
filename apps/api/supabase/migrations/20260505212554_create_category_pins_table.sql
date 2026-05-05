create table category_pins (
    id bigint generated always as identity primary key,
    created_at timestamp with time zone default current_timestamp,
    updated_at timestamp with time zone default current_timestamp,

    user_id bigint not null default get_authenticated_user_id() references users(id) on delete cascade,
    category_id bigint not null references categories(id) on delete cascade,

    constraint category_pins_user_category_key
        unique (user_id, category_id)
);

alter table category_pins enable row level security;

create policy "Users can read own category pins"
  on category_pins for select
  to authenticated
  using (user_id in (select id from users where external_id = auth.uid()::text));

create policy "Users can insert own category pins"
  on category_pins for insert
  to authenticated
  with check (user_id in (select id from users where external_id = auth.uid()::text));

create policy "Users can delete own category pins"
  on category_pins for delete
  to authenticated
  using (user_id in (select id from users where external_id = auth.uid()::text));

create or replace function set_category_pin_user_id()
returns trigger as $$
begin
  new.user_id := get_authenticated_user_id();
  return new;
end;
$$ language plpgsql security invoker set search_path = public;

create trigger trg_set_category_pin_user_id
  before insert on category_pins
  for each row
  execute function set_category_pin_user_id();
