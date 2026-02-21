import { assertEquals } from "@std/assert"
import { Database } from "../shared/types.ts"
import { createSupabaseStub } from "../test/utils/supabaseStub.ts"
import { createSupabasePaymentRepository } from "./paymentRepositoryImpl.ts"
import { createAmount } from "../domain/valueObjects/amount.ts"
import { createNote } from "../domain/valueObjects/note.ts"
import { createPaymentDate } from "../domain/valueObjects/paymentDate.ts"
import { createUserId } from "../domain/valueObjects/userId.ts"
import { unwrapOk } from "../shared/unwrapOk.ts"

type PaymentsRow = Database["public"]["Tables"]["payments"]["Row"]

const sampleRow: PaymentsRow = {
  id: 1,
  note: "ランチ",
  amount: 1200,
  date: "2024-01-10",
  created_at: "2024-01-11T00:00:00Z",
  updated_at: "2024-01-11T00:00:00Z",
  category_id: 2,
  user_id: 1,
}

const insertedRow: PaymentsRow = {
  id: 2,
  note: "ディナー",
  amount: 2500,
  date: "2024-01-20",
  created_at: "2024-01-20T00:00:00Z",
  updated_at: "2024-01-20T00:00:00Z",
  category_id: null,
  user_id: 1,
}

Deno.test("createSupabasePaymentRepository returns a PaymentRepository", async () => {
  const { supabase } = createSupabaseStub({ data: [sampleRow] })
  const repo = createSupabasePaymentRepository({
    supabase,
  })

  const result = await repo.search({ userId: 1 })
  assertEquals(result.isOk, true)
  if (result.isOk) {
    assertEquals(Array.isArray(result.value), true)
  }
})

Deno.test("Supabase 経由で payments を取得できる", async () => {
  const { supabase, recorded } = createSupabaseStub({ data: [sampleRow] })
  const repo = createSupabasePaymentRepository({ supabase })

  const result = await repo.search({ userId: 1 })
  assertEquals(result.isOk, true)
  if (result.isOk) {
    assertEquals(result.value.length, 1)
  }

  assertEquals(recorded.table, "payments")
  assertEquals(recorded.filters, [
    { kind: "eq", column: "user_id", value: 1 },
  ])
  assertEquals(recorded.orders, [
    { column: "date", ascending: false },
    { column: "id", ascending: false },
  ])
})

Deno.test("日付フィルタを付与して検索できる", async () => {
  const { supabase, recorded } = createSupabaseStub({ data: [sampleRow] })
  const repo = createSupabasePaymentRepository({ supabase })

  await repo.search({
    userId: 42,
    dateFrom: "2024-01-01",
    dateTo: "2024-01-31",
  })

  const gteFilter = recorded.filters.find((f) => f.kind === "gte")
  const lteFilter = recorded.filters.find((f) => f.kind === "lte")

  assertEquals(gteFilter, {
    kind: "gte",
    column: "date",
    value: "2024-01-01",
  })
  assertEquals(lteFilter, {
    kind: "lte",
    column: "date",
    value: "2024-01-31",
  })
})

Deno.test("Supabase エラーを Result.err として返す", async () => {
  const { supabase } = createSupabaseStub({
    error: { message: "boom" },
  })
  const repo = createSupabasePaymentRepository({ supabase })

  const result = await repo.search({ userId: 1 })
  assertEquals(result.isOk, false)
})

Deno.test("指定月の合計支出額を取得できる", async () => {
  const { supabase, recorded } = createSupabaseStub({
    rpcData: 1300,
  })
  const repo = createSupabasePaymentRepository({ supabase })

  const result = await repo.monthlyTotal({ userId: 1, month: "2024-01" })
  assertEquals(result.isOk, true)
  if (result.isOk) {
    assertEquals(result.value, 1300)
  }

  assertEquals(recorded.rpcCalls, [{
    fn: "get_monthly_total_amount",
    args: { p_user_id: 1, p_month: "2024-01" },
  }])
})

Deno.test("月次合計取得でSupabaseエラーをResult.errとして返す", async () => {
  const { supabase } = createSupabaseStub({
    rpcError: { message: "boom" },
  })
  const repo = createSupabasePaymentRepository({ supabase })

  const result = await repo.monthlyTotal({ userId: 1, month: "2024-01" })
  assertEquals(result.isOk, false)
})

Deno.test("月次合計取得でnullなら0を返す", async () => {
  const { supabase } = createSupabaseStub({
    rpcData: null,
  })
  const repo = createSupabasePaymentRepository({ supabase })

  const result = await repo.monthlyTotal({ userId: 1, month: "2024-01" })
  assertEquals(result.isOk, true)
  if (result.isOk) {
    assertEquals(result.value, 0)
  }
})

Deno.test("Supabase 経由で payments を作成できる", async () => {
  const { supabase, recorded } = createSupabaseStub({
    insertData: insertedRow,
  })
  const repo = createSupabasePaymentRepository({ supabase })

  const userId = unwrapOk(createUserId(1))
  const amount = unwrapOk(createAmount(2500))
  const date = unwrapOk(createPaymentDate(new Date("2024-01-20")))
  const note = unwrapOk(createNote("ディナー"))

  const result = await repo.create({
    userId,
    amount,
    date,
    note,
    categoryId: null,
  })

  assertEquals(result.isOk, true)
  if (result.isOk) {
    assertEquals(result.value.id.value, 2)
  }

  assertEquals(recorded.table, "payments")
  assertEquals(recorded.inserts, [{
    table: "payments",
    values: {
      user_id: 1,
      amount: 2500,
      date: "2024-01-20",
      note: "ディナー",
      category_id: null,
    },
  }])
})
