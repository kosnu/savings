create or replace function keep_category_book_id()
returns trigger as $$
begin
  new.book_id := old.book_id;
  return new;
end;
$$ language plpgsql security invoker set search_path = public;

create trigger trg_keep_category_book_id
  before update on categories
  for each row
  execute function keep_category_book_id();

create or replace function update_category_updated_at()
returns trigger as $$
begin
  new.updated_at := current_timestamp;
  return new;
end;
$$ language plpgsql security invoker set search_path = public;

create trigger trg_update_category_updated_at
  before update on categories
  for each row
  execute function update_category_updated_at();

create policy "Users can update member book categories"
  on categories for update
  to authenticated
  using (
    exists (
      select 1
      from book_members
      where book_members.book_id = categories.book_id
        and book_members.user_id = get_authenticated_user_id()
    )
  )
  with check (
    exists (
      select 1
      from book_members
      where book_members.book_id = categories.book_id
        and book_members.user_id = get_authenticated_user_id()
    )
  );
