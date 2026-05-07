with seed_categories (name) as (
  values
    ('食費'),
    ('外食'),
    ('日用品'),
    ('娯楽品'),
    ('遊び'),
    ('交通費'),
    ('衣類・美容'),
    ('薬・病院'),
    ('書籍'),
    ('交際費'),
    ('ギャンブル'),
    ('税金'),
    ('固定費'),
    ('その他')
)
insert into categories (book_id, name)
select default_books.book_id, seed_categories.name
from (
  select distinct book_id
  from book_members
  where is_default
) default_books
cross join seed_categories
on conflict (book_id, name) do nothing;
