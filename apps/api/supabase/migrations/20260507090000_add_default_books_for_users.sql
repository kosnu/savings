alter table book_members
  add column is_default boolean not null default false;

create unique index book_members_user_default_key
  on book_members (user_id)
  where is_default;

create or replace function create_default_book_for_user()
returns trigger as $$
declare
  default_book_id bigint;
begin
  insert into books (name)
  values ('Default Book')
  returning id into default_book_id;

  insert into book_members (book_id, user_id, is_default)
  values (default_book_id, new.id, true);

  return new;
end;
$$ language plpgsql security invoker set search_path = public;

create trigger trg_create_default_book_for_user
  after insert on users
  for each row
  execute function create_default_book_for_user();

do $$
declare
  user_record record;
  default_book_id bigint;
begin
  for user_record in
    select id
    from users
    where not exists (
      select 1
      from book_members
      where book_members.user_id = users.id
        and book_members.is_default
    )
    order by id
  loop
    insert into books (name)
    values ('Default Book')
    returning id into default_book_id;

    insert into book_members (book_id, user_id, is_default)
    values (default_book_id, user_record.id, true);
  end loop;
end $$;
