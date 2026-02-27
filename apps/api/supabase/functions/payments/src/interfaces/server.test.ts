import { assertEquals } from "@std/assert"
import { createServer } from "./server.ts"

Deno.test("SUPABASE_URLが未設定の場合、500を返す", async () => {
  const original = Deno.env.get("SUPABASE_URL")
  Deno.env.delete("SUPABASE_URL")
  try {
    const app = createServer()
    const res = await app.request("/")
    assertEquals(res.status, 500)
    const body = await res.json()
    assertEquals(body.error, "Internal Server Error")
  } finally {
    if (original) Deno.env.set("SUPABASE_URL", original)
  }
})

Deno.test("SUPABASE_ANON_KEYが未設定の場合、500を返す", async () => {
  const original = Deno.env.get("SUPABASE_ANON_KEY")
  Deno.env.delete("SUPABASE_ANON_KEY")
  try {
    const app = createServer()
    const res = await app.request("/")
    assertEquals(res.status, 500)
    const body = await res.json()
    assertEquals(body.error, "Internal Server Error")
  } finally {
    if (original) Deno.env.set("SUPABASE_ANON_KEY", original)
  }
})
