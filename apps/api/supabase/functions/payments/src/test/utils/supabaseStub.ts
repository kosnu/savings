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
}

export type CreateSupabaseStubOptions = {
  data?: PaymentsRow[] | null
  error?: { message: string } | null
}

export const createSupabaseStub = (
  { data = [], error = null }: CreateSupabaseStubOptions = {},
) => {
  const recorded: RecordedQueries = {
    table: "",
    filters: [] as FilterRecord[],
    orders: [] as OrderRecord[],
  }

  const chain = {
    select() {
      return chain
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
  }

  return {
    supabase: supabase as unknown as SupabaseClient<Database>,
    recorded,
  }
}
