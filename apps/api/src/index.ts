import { Hono } from "hono"
import type { Env } from "./db/client"
import { touch } from "./sampleDbAccess"

const app = new Hono()

app.get("/", async (c) => {
  // Worker 環境では c.env を渡すことで D1 binding が使われます
  console.log("c.env:", c.env)

  try {
    await touch(c.env as Env) // FIXME: 強制的にキャストしているのを直す
  } catch (e) {
    // ログは wrangler/miniflare のコンソールに出力されます
    console.error("touch failed:", e)
    return c.text("Error occurred", 500)
  }
  return c.text("Hello Hono!")
})

export default app
