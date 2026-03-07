import { assertEquals } from "@std/assert"
import { createSupabaseStub } from "../test/utils/supabaseStub.ts"
import { createSupabasePaymentRepository } from "./paymentRepositoryImpl.ts"

Deno.test("createSupabasePaymentRepository returns a PaymentRepository", async () => {
  const { supabase } = createSupabaseStub({ rpcData: 0 })
  const repo = createSupabasePaymentRepository({
    supabase,
  })

  const result = await repo.monthlyTotal({ month: "2024-01" })
  assertEquals(result.isOk, true)
})

Deno.test("指定月の合計支出額を取得できる", async () => {
  const { supabase, recorded } = createSupabaseStub({
    rpcData: 1300,
  })
  const repo = createSupabasePaymentRepository({ supabase })

  const result = await repo.monthlyTotal({ month: "2024-01" })
  assertEquals(result.isOk, true)
  if (result.isOk) {
    assertEquals(result.value, 1300)
  }

  assertEquals(recorded.rpcCalls, [{
    fn: "get_monthly_total_amount",
    args: { p_month: "2024-01" },
  }])
})

Deno.test("月次合計取得でSupabaseエラーをResult.errとして返す", async () => {
  const { supabase } = createSupabaseStub({
    rpcError: { message: "boom" },
  })
  const repo = createSupabasePaymentRepository({ supabase })

  const result = await repo.monthlyTotal({ month: "2024-01" })
  assertEquals(result.isOk, false)
})

Deno.test("月次合計取得でnullなら0を返す", async () => {
  const { supabase } = createSupabaseStub({
    rpcData: null,
  })
  const repo = createSupabasePaymentRepository({ supabase })

  const result = await repo.monthlyTotal({ month: "2024-01" })
  assertEquals(result.isOk, true)
  if (result.isOk) {
    assertEquals(result.value, 0)
  }
})
