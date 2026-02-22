import "@supabase/functions-js/edge-runtime"
import { createClient } from "@supabase/supabase-js"
import { createServer } from "./src/interfaces/server.ts"
import { Database } from "./src/shared/types.ts"

const supabaseUrl = Deno.env.get("SUPABASE_URL")
const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase の接続情報が未設定です")
}

const app = createServer({
  supabaseFactory: () =>
    createClient<Database>(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    }),
})

Deno.serve((req) => app.fetch(req))
