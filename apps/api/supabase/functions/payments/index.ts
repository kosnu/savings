// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import type { PostgrestError } from "@supabase/supabase-js"

function isPostgrestError(err: unknown): err is PostgrestError {
  return typeof err === "object" && err !== null && "message" in err
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    )

    // TODO: Change the table_name to your table
    const { data, error } = await supabase.from("payments")
      .select("*")

    if (error) throw error

    return new Response(JSON.stringify({ data }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  } catch (err) {
    // catch の err はランタイム上はいろいろ来る可能性があるため unknown で受け
    // PostgrestError の形に合わせて応答を整形する。型が確定しない場合は汎用的な message を返す。
    if (isPostgrestError(err)) {
      // PostgrestError は message, details, hint, code などを持ちます（null あり）
      return new Response(
        JSON.stringify({
          message: err.message,
          details: err.details,
          hint: err.hint,
          code: err.code,
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 500,
        },
      )
    }

    if (err instanceof Error) {
      return new Response(JSON.stringify({ message: err.message }), {
        headers: { "Content-Type": "application/json" },
        status: 500,
      })
    }

    // 最後のフォールバック
    return new Response(JSON.stringify({ message: String(err) }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    })
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/payments' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
