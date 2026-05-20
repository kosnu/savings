create policy "Users can insert member book categories"
  on categories for insert
  to authenticated
  with check (
    exists (
      select 1
      from book_members
      where book_members.book_id = categories.book_id
        and book_members.user_id = get_authenticated_user_id()
    )
  );
