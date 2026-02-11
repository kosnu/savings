import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../shared/types.ts"
import { DomainError, unexpectedError } from "../../shared/errors.ts"
import { err, ok, Result } from "../../shared/result.ts"

/**
 * Supabase Auth の user.id (UUID) から users テーブルの id (number) を取得する
 */
export async function getUserIdByExternalId(
  supabase: SupabaseClient<Database>,
  externalId: string,
): Promise<Result<number, DomainError>> {
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("external_id", externalId)
    .single()

  if (error) {
    return err(unexpectedError("Failed to fetch user by external_id", error))
  }

  return ok(data.id)
}
