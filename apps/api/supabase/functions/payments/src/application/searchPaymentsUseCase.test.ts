import { assertEquals } from "@std/assert"
import { createPayment } from "../domain/entities/payment.ts"
import { PaymentRepository, PaymentSearchParams } from "../domain/repository.ts"
import { unexpectedError } from "../shared/errors.ts"
import { err, ok } from "../shared/result.ts"
import { searchPaymentsUseCase } from "./searchPaymentsUseCase.ts"

const samplePayment = createPayment({
  id: 1n,
  note: "ランチ",
  amount: 1200,
  date: new Date("2024-01-10"),
  createdAt: new Date("2024-01-11T00:00:00Z"),
  updatedAt: new Date("2024-01-11T00:00:00Z"),
  categoryId: 2n,
  userId: 1n,
})

Deno.test("searchPaymentsUseCase は検索条件をリポジトリへ渡す", async () => {
  const recorded: { params?: PaymentSearchParams } = {}
  const repository: PaymentRepository = {
    // deno-lint-ignore require-await
    search: async (params) => {
      recorded.params = params
      return ok([samplePayment])
    },
  }

  const criteria: PaymentSearchParams = {
    userId: 1n,
    dateFrom: "2024-01-01",
    dateTo: "2024-01-31",
  }

  const result = await searchPaymentsUseCase(criteria, repository)

  assertEquals(recorded.params, criteria)
  assertEquals(result.isOk, true)
  if (result.isOk) {
    assertEquals(result.value, [samplePayment])
  }
})

Deno.test("searchPaymentsUseCase はエラーをそのまま返す", async () => {
  const repository: PaymentRepository = {
    // deno-lint-ignore require-await
    search: async () => err(unexpectedError("boom")),
  }

  const result = await searchPaymentsUseCase({ userId: 1n }, repository)

  assertEquals(result.isOk, false)
  if (!result.isOk) {
    assertEquals(result.error.type, "UnexpectedError")
    assertEquals(result.error.message, "boom")
  }
})
