import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import { createServer } from "./src/interfaces/server.ts"
import { Database } from "./src/shared/types.ts"

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase の接続情報が未設定です")
}

const app = createServer({
  supabaseFactory: (req) =>
    createClient<Database>(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") ?? "",
        },
      },
    }),
})

Deno.serve((req) => app.fetch(req))
