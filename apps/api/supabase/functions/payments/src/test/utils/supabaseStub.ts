import { SupabaseClient } from "@supabase/supabase-js"
import { Database } from "../../shared/types.ts"

type PaymentsRow = Database["public"]["Tables"]["payments"]["Row"]

export type FilterRecord = {
  kind: "eq" | "gte" | "lte"
  column: string
  value: unknown
}

export type OrderRecord = {
  column: string
  ascending?: boolean
}

export type RecordedQueries = {
  table: string
  filters: FilterRecord[]
  orders: OrderRecord[]
  inserts: Array<{ table: string; values: unknown }>
  rpcCalls: Array<{ fn: string; args: unknown }>
}

export type CreateSupabaseStubOptions = {
  data?: PaymentsRow[] | null
  error?: { message: string } | null
  insertData?: PaymentsRow | null
  insertError?: { message: string } | null
  rpcData?: unknown
  rpcError?: { message: string } | null
}

export const createSupabaseStub = (
  {
    data = [],
    error = null,
    insertData = null,
    insertError = null,
    rpcData = 0,
    rpcError = null,
  }: CreateSupabaseStubOptions = {},
) => {
  const recorded: RecordedQueries = {
    table: "",
    filters: [] as FilterRecord[],
    orders: [] as OrderRecord[],
    inserts: [],
    rpcCalls: [],
  }

  const chain = {
    select() {
      return chain
    },
    insert(values: unknown) {
      recorded.inserts.push({ table: recorded.table, values })
      return chain
    },
    single() {
      return Promise.resolve({ data: insertData, error: insertError })
    },
    eq(column: string, value: unknown) {
      recorded.filters.push({ kind: "eq", column, value })
      return chain
    },
    gte(column: string, value: unknown) {
      recorded.filters.push({ kind: "gte", column, value })
      return chain
    },
    lte(column: string, value: unknown) {
      recorded.filters.push({ kind: "lte", column, value })
      return chain
    },
    order(column: string, opts?: { ascending?: boolean }) {
      recorded.orders.push({ column, ascending: opts?.ascending })
      return chain
    },
    then<TResult1 = unknown, TResult2 = never>(
      onfulfilled?:
        | ((
          value: {
            data: PaymentsRow[] | null
            error: { message: string } | null
          },
        ) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?:
        | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
        | null,
    ) {
      return Promise.resolve({ data, error }).then(onfulfilled, onrejected)
    },
  }

  const supabase = {
    from(table: string) {
      recorded.table = table
      return chain
    },
    rpc(fn: string, args: unknown) {
      recorded.rpcCalls.push({ fn, args })
      return Promise.resolve({ data: rpcData, error: rpcError })
    },
  }

  return {
    supabase: supabase as unknown as SupabaseClient<Database>,
    recorded,
  }
}
