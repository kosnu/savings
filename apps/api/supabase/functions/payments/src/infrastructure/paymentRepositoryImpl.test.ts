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
  id: 1n,
  note: "ランチ",
  amount: 1200,
  date: "2024-01-10",
  created_at: "2024-01-11T00:00:00Z",
  updated_at: "2024-01-11T00:00:00Z",
  category_id: 2n,
  user_id: 1n,
}

const insertedRow: PaymentsRow = {
  id: 2n,
  note: "ディナー",
  amount: 2500,
  date: "2024-01-20",
  created_at: "2024-01-20T00:00:00Z",
  updated_at: "2024-01-20T00:00:00Z",
  category_id: null,
  user_id: 1n,
}

Deno.test("createSupabasePaymentRepository returns a PaymentRepository", async () => {
  const { supabase } = createSupabaseStub({ data: [sampleRow] })
  const repo = createSupabasePaymentRepository({
    supabase,
  })

  const result = await repo.search({ userId: 1n })
  assertEquals(result.isOk, true)
  if (result.isOk) {
    assertEquals(Array.isArray(result.value), true)
  }
})

Deno.test("Supabase 経由で payments を取得できる", async () => {
  const { supabase, recorded } = createSupabaseStub({ data: [sampleRow] })
  const repo = createSupabasePaymentRepository({ supabase })

  const result = await repo.search({ userId: 1n })
  assertEquals(result.isOk, true)
  if (result.isOk) {
    assertEquals(result.value.length, 1)
  }

  assertEquals(recorded.table, "payments")
  assertEquals(recorded.filters, [
    { kind: "eq", column: "user_id", value: 1n },
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
    userId: 42n,
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

  const result = await repo.search({ userId: 1n })
  assertEquals(result.isOk, false)
})

Deno.test("Supabase 経由で payments を作成できる", async () => {
  const { supabase, recorded } = createSupabaseStub({
    insertData: insertedRow,
  })
  const repo = createSupabasePaymentRepository({ supabase })

  const userId = unwrapOk(createUserId(1n))
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
    assertEquals(result.value.id.value, 2n)
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
