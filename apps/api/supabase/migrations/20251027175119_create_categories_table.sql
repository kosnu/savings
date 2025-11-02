create table categories (
    id bigint generated always as identity primary key,
    name varchar(255) not null unique,
    created_at timestamp with time zone default current_timestamp,
    updated_at timestamp with time zone default current_timestamp
);
