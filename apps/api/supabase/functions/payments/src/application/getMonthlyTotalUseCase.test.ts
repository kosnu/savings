import { assertEquals } from "@std/assert"
import { PaymentRepository } from "../domain/repository.ts"
import { unexpectedError } from "../shared/errors.ts"
import { err, ok } from "../shared/result.ts"
import { getMonthlyTotalUseCase } from "./getMonthlyTotalUseCase.ts"

Deno.test("getMonthlyTotalUseCase は月次条件をリポジトリへ渡す", async () => {
  const recorded: {
    params?: Parameters<PaymentRepository["monthlyTotal"]>[0]
  } = {}
  const repository: PaymentRepository = {
    // deno-lint-ignore require-await
    monthlyTotal: async (params) => {
      recorded.params = params
      return ok(3200)
    },
  }

  const result = await getMonthlyTotalUseCase(
    { month: "2024-01" },
    repository,
  )

  assertEquals(recorded.params, { month: "2024-01" })
  assertEquals(result.isOk, true)
  if (result.isOk) {
    assertEquals(result.value, 3200)
  }
})

Deno.test("getMonthlyTotalUseCase はエラーをそのまま返す", async () => {
  const repository: PaymentRepository = {
    // deno-lint-ignore require-await
    monthlyTotal: async () => err(unexpectedError("boom")),
  }

  const result = await getMonthlyTotalUseCase(
    { month: "2024-01" },
    repository,
  )

  assertEquals(result.isOk, false)
  if (!result.isOk) {
    assertEquals(result.error.type, "UnexpectedError")
    assertEquals(result.error.message, "boom")
  }
})
