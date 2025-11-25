import { PostgrestError } from "@supabase/supabase-js"

export function isPostgrestError(err: unknown): err is PostgrestError {
  return (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    "code" in err &&
    "details" in err &&
    "hint" in err
  )
}
