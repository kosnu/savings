import type { Database as GeneratedDatabase } from "../generated/database.types.ts"

// Supabase の自動生成型をそのまま利用する
export type Database = GeneratedDatabase

export type PaymentRecord = Database["public"]["Tables"]["payments"]["Row"]
