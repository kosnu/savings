create table users (
    id bigint generated always as identity primary key,
    external_id varchar(255) not null unique,
    name varchar(255) not null,
    email varchar(255) not null unique,
    created_at timestamp with time zone default current_timestamp,
    updated_at timestamp with time zone default current_timestamp
);
