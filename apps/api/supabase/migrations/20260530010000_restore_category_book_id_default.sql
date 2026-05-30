alter table categories
  alter column book_id set default get_authenticated_default_book_id();
