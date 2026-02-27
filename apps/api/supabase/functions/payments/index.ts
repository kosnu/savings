import "@supabase/functions-js/edge-runtime"
import { createServer } from "./src/interfaces/server.ts"

const app = createServer()

Deno.serve((req) => app.fetch(req))
