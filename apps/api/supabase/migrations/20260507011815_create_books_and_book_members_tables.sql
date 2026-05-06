create table books (
    id bigint generated always as identity primary key,
    name varchar(255) not null,
    created_at timestamp with time zone default current_timestamp,
    updated_at timestamp with time zone default current_timestamp
);

create table book_members (
    id bigint generated always as identity primary key,
    created_at timestamp with time zone default current_timestamp,
    updated_at timestamp with time zone default current_timestamp,

    book_id bigint not null references books(id) on delete cascade,
    user_id bigint not null references users(id) on delete cascade,

    constraint book_members_book_user_key
        unique (book_id, user_id)
);

create index idx_book_members_user_book
    on book_members (user_id, book_id);

alter table books enable row level security;

create policy "Users can read member books"
  on books for select
  to authenticated
  using (
    exists (
      select 1
      from book_members
      where book_members.book_id = books.id
        and book_members.user_id in (
          select id from users where external_id = auth.uid()::text
        )
    )
  );

alter table book_members enable row level security;

create policy "Users can read own book memberships"
  on book_members for select
  to authenticated
  using (
    user_id in (
      select id from users where external_id = auth.uid()::text
    )
  );
