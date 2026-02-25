import { createClient } from "@supabase/supabase-js"
import type { PaymentInsert } from "./types.ts"

/**
 * Supabaseにバッチで支払いデータをインサートする
 */
export async function insertPayments(
  supabaseUrl: string,
  serviceRoleKey: string,
  payments: PaymentInsert[],
): Promise<void> {
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { error } = await supabase.from("payments").insert(payments)

  if (error) {
    throw new Error(`Supabase insert エラー: ${error.message}`)
  }

  console.log(`Supabase: ${payments.length}件インサート完了`)
}
