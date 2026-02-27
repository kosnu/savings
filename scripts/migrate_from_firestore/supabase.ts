import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { PaymentInsert } from "./types.ts"

const BATCH_SIZE = 100

let client: SupabaseClient | null = null

function getClient(
  supabaseUrl: string,
  serviceRoleKey: string,
): SupabaseClient {
  if (!client) {
    client = createClient(supabaseUrl, serviceRoleKey)
  }
  return client
}

/**
 * Supabaseにバッチで支払いデータをインサートする
 */
export async function insertPayments(
  supabaseUrl: string,
  serviceRoleKey: string,
  payments: PaymentInsert[],
): Promise<void> {
  const supabase = getClient(supabaseUrl, serviceRoleKey)

  // バッチ分割でインサート
  for (let i = 0; i < payments.length; i += BATCH_SIZE) {
    const batch = payments.slice(i, i + BATCH_SIZE)
    const { error } = await supabase.from("payments").insert(batch)

    if (error) {
      throw new Error(
        `Supabase insert エラー (バッチ ${
          Math.floor(i / BATCH_SIZE) + 1
        }): ${error.message}`,
      )
    }

    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(payments.length / BATCH_SIZE)
    console.log(`  バッチ ${batchNum}/${totalBatches}: ${batch.length}件完了`)
  }
}
