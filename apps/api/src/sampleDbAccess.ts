// import 'dotenv/config';

import { v7 as uuidv7 } from "uuid"
import type { Env } from "./db/client"
import { getDB } from "./db/client"
import { usersTable } from "./db/schema"

/**
 * サンプル：Worker または Node から呼べるように Env を受け取る形にします。
 * - Worker の場合は handler から `c.env` を渡す
 * - ローカルの Node 実行なら `undefined`（process.env を参照して getDB が動く）
 */
export async function touch(env?: Env) {
  const dbFile =
    typeof process !== "undefined" && process.env
      ? process.env.DB_FILE_NAME
      : undefined
  if (!dbFile && !env?.DB) {
    throw new Error(
      "Environment variable DB_FILE_NAME is required (or provide Env.DB)",
    )
  }

  const db = getDB(env)

  const emailPrefix = uuidv7().slice(25, 36) // 生成した UUID の一部をメールのプレフィックスに使用

  const user: typeof usersTable.$inferInsert = {
    id: uuidv7(),
    name: "John",
    email: `john-${emailPrefix}@example.com`,
  }

  console.log("Inserting user:", user)
  try {
    await db.insert(usersTable).values(user)
  } catch (err) {
    console.error("Insert error:", err)
    throw err
  }
  console.log("New user created!")
}
