import { assertEquals } from "@std/assert"
import { createPayment } from "../domain/entities/payment.ts"
import { PaymentRepository } from "../domain/repository.ts"
import { unexpectedError } from "../shared/errors.ts"
import { err, ok } from "../shared/result.ts"
import { getMonthlyTotalUseCase } from "./getMonthlyTotalUseCase.ts"

const samplePayment = createPayment({
  id: 1,
  note: "ランチ",
  amount: 1200,
  date: new Date("2024-01-10"),
  createdAt: new Date("2024-01-11T00:00:00Z"),
  updatedAt: new Date("2024-01-11T00:00:00Z"),
  categoryId: 2,
  userId: 1,
})

Deno.test("getMonthlyTotalUseCase は月次条件をリポジトリへ渡す", async () => {
  const recorded: {
    params?: Parameters<PaymentRepository["monthlyTotal"]>[0]
  } = {}
  const repository: PaymentRepository = {
    // deno-lint-ignore require-await
    search: async () => ok([samplePayment]),
    // deno-lint-ignore require-await
    monthlyTotal: async (params) => {
      recorded.params = params
      return ok(3200)
    },
    // deno-lint-ignore require-await
    create: async () => ok(samplePayment),
  }

  const result = await getMonthlyTotalUseCase(
    { userId: 1, month: "2024-01" },
    repository,
  )

  assertEquals(recorded.params, { userId: 1, month: "2024-01" })
  assertEquals(result.isOk, true)
  if (result.isOk) {
    assertEquals(result.value, 3200)
  }
})

Deno.test("getMonthlyTotalUseCase はエラーをそのまま返す", async () => {
  const repository: PaymentRepository = {
    // deno-lint-ignore require-await
    search: async () => ok([samplePayment]),
    // deno-lint-ignore require-await
    monthlyTotal: async () => err(unexpectedError("boom")),
    // deno-lint-ignore require-await
    create: async () => ok(samplePayment),
  }

  const result = await getMonthlyTotalUseCase(
    { userId: 1, month: "2024-01" },
    repository,
  )

  assertEquals(result.isOk, false)
  if (!result.isOk) {
    assertEquals(result.error.type, "UnexpectedError")
    assertEquals(result.error.message, "boom")
  }
})
