-- Reset all application tables and recreate according to current schema
BEGIN TRANSACTION;

-- Drop app tables if exist
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

-- Create users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);

-- Create categories
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

-- Create payments
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  categoryId TEXT NOT NULL,
  amount INTEGER NOT NULL,
  note TEXT NOT NULL,
  date TEXT NOT NULL,
  createdDatetime TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (userId) REFERENCES users(id) ON UPDATE NO ACTION ON DELETE NO ACTION,
  FOREIGN KEY (categoryId) REFERENCES categories(id) ON UPDATE NO ACTION ON DELETE NO ACTION
);

COMMIT;
