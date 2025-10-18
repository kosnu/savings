import { int, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const usersTable = sqliteTable("users", {
  id: text().notNull().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
})

export const categoriesTable = sqliteTable("categories", {
  id: text().notNull().primaryKey(),
  name: text().notNull(),
})

export const paymentsTable = sqliteTable("payments", {
  id: text().notNull().primaryKey(),
  userId: text()
    .notNull()
    .references(() => usersTable.id),
  categoryId: text()
    .notNull()
    .references(() => categoriesTable.id),
  amount: int().notNull(),
  note: text().notNull(),
  date: text().notNull(),
  createdDatetime: text().notNull().default(new Date().toISOString()),
})
