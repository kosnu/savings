create policy "Users can delete member book categories"
  on categories for delete
  to authenticated
  using (
    exists (
      select 1
      from book_members
      where book_members.book_id = categories.book_id
        and book_members.user_id = get_authenticated_user_id()
    )
  );

create index idx_payments_category_id
  on payments (category_id);

create index idx_category_pins_category_id
  on category_pins (category_id);
