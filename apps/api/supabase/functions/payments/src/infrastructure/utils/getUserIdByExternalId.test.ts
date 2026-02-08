import { assertEquals } from "@std/assert"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../shared/types.ts"
import { getUserIdByExternalId } from "./getUserIdByExternalId.ts"

type UsersRow = Database["public"]["Tables"]["users"]["Row"]

type CreateSupabaseStubOptions = {
  data?: UsersRow | null
  error?: { message: string; code?: string } | null
}

const createSupabaseStubForUsers = (
  { data = null, error = null }: CreateSupabaseStubOptions = {},
) => {
  const recorded: {
    table: string
    filters: Array<{ kind: string; column: string; value: unknown }>
    single: boolean
  } = {
    table: "",
    filters: [],
    single: false,
  }

  const chain = {
    select() {
      return chain
    },
    eq(column: string, value: unknown) {
      recorded.filters.push({ kind: "eq", column, value })
      return chain
    },
    single() {
      recorded.single = true
      return {
        then<TResult1 = unknown, TResult2 = never>(
          onfulfilled?:
            | ((
              value: {
                data: UsersRow | null
                error: { message: string; code?: string } | null
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

Deno.test("getUserIdByExternalId はexternal_idからidを取得する", async () => {
  const userData: UsersRow = {
    id: 123n,
    external_id: "uuid-1234",
    name: "Test User",
    email: "test@example.com",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  }

  const { supabase, recorded } = createSupabaseStubForUsers({ data: userData })

  const result = await getUserIdByExternalId(supabase, "uuid-1234")

  assertEquals(recorded.table, "users")
  assertEquals(recorded.filters, [
    { kind: "eq", column: "external_id", value: "uuid-1234" },
  ])
  assertEquals(recorded.single, true)
  assertEquals(result.isOk, true)
  if (result.isOk) {
    assertEquals(result.value, 123n)
  }
})

Deno.test("getUserIdByExternalId はSupabaseエラーをResult.errとして返す", async () => {
  const { supabase } = createSupabaseStubForUsers({
    error: { message: "User not found", code: "PGRST116" },
  })

  const result = await getUserIdByExternalId(supabase, "unknown-uuid")

  assertEquals(result.isOk, false)
  if (!result.isOk) {
    assertEquals(result.error.type, "UnexpectedError")
    assertEquals(result.error.message, "Failed to fetch user by external_id")
  }
})

Deno.test("getUserIdByExternalId はbigint型のidを返す", async () => {
  const userData: UsersRow = {
    id: 999n,
    external_id: "uuid-999",
    name: "User 999",
    email: "user999@example.com",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  }

  const { supabase } = createSupabaseStubForUsers({ data: userData })

  const result = await getUserIdByExternalId(supabase, "uuid-999")

  assertEquals(result.isOk, true)
  if (result.isOk) {
    assertEquals(typeof result.value, "bigint")
    assertEquals(result.value, 999n)
  }
})
