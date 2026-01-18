import type { Database as GeneratedDatabase } from "../generated/database.types.ts"

// Supabase の自動生成型をベースに id / *_id カラムを bigint として扱う
type ReplaceNumberWithBigint<T> = T extends number ? bigint
  : T extends number | null | undefined ? Exclude<T, number> | bigint
  : T

type WithBigIntIds<T> = {
  [K in keyof T]: K extends "id" | `${string}_id`
    ? ReplaceNumberWithBigint<T[K]>
    : T[K]
}

type ReplaceRowIds<TTables extends Record<string, { Row: unknown }>> = {
  [TableName in keyof TTables]: TTables[TableName] extends {
    Row: infer RowType
  } ? Omit<TTables[TableName], "Row"> & { Row: WithBigIntIds<RowType> }
    : TTables[TableName]
}

type PublicSchema = GeneratedDatabase["public"]

export type Database = Omit<GeneratedDatabase, "public"> & {
  public: Omit<PublicSchema, "Tables"> & {
    Tables: ReplaceRowIds<PublicSchema["Tables"]>
  }
}

export type PaymentRecord = Database["public"]["Tables"]["payments"]["Row"]
