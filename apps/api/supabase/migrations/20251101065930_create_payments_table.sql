create table payments (
    id bigint generated always as identity primary key,
    note varchar(255),
    amount numeric(10, 2) not null,
    date date not null,
    created_at timestamp with time zone default current_timestamp,
    updated_at timestamp with time zone default current_timestamp,

    category_id bigint references categories(id) on delete set null,
    user_id bigint references users(id) on delete set null
);

create index idx_payments_user_date_category_created on payments (user_id, date, category_id, created_at);
