import { assertEquals } from "@std/assert"
import { PaymentRepository } from "../domain/repository.ts"
import {
  CreatePaymentInput,
  createPaymentUseCase,
} from "./createPaymentUseCase.ts"
import { createPayment } from "../domain/entities/payment.ts"
import { err, ok } from "../shared/result.ts"
import { unexpectedError } from "../shared/errors.ts"

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

Deno.test("createPaymentUseCase は作成条件をリポジトリへ渡す", async () => {
  const recorded: { params?: Parameters<PaymentRepository["create"]>[0] } = {}
  const repository: PaymentRepository = {
    // deno-lint-ignore require-await
    search: async () => ok([]),
    // deno-lint-ignore require-await
    create: async (params) => {
      recorded.params = params
      return ok(samplePayment)
    },
  }

  const params: CreatePaymentInput = {
    userId: 1n,
    amount: 1200,
    date: "2024-01-10",
    note: "ランチ",
    categoryId: 2n,
  }

  const result = await createPaymentUseCase(params, repository)

  assertEquals(recorded.params?.userId.value, 1n)
  assertEquals(recorded.params?.amount.value, 1200)
  assertEquals(
    recorded.params?.date.value.toISOString().slice(0, 10),
    "2024-01-10",
  )
  assertEquals(recorded.params?.note.value, "ランチ")
  assertEquals(recorded.params?.categoryId?.value, 2n)
  assertEquals(result.isOk, true)
  if (result.isOk) {
    assertEquals(result.value, samplePayment)
  }
})

Deno.test("date が不正な場合は ValidationError を返す", async () => {
  const repository: PaymentRepository = {
    // deno-lint-ignore require-await
    search: async () => ok([]),
    // deno-lint-ignore require-await
    create: async () => ok(samplePayment),
  }

  const result = await createPaymentUseCase({
    userId: 1n,
    amount: 1200,
    date: "2024/01/10",
    note: null,
    categoryId: null,
  }, repository)

  assertEquals(result.isOk, false)
  if (!result.isOk) {
    assertEquals(result.error.type, "ValidationError")
    assertEquals(result.error.message, "date must be YYYY-MM-DD")
  }
})

Deno.test("金額が整数でない場合は ValidationError を返す", async () => {
  const repository: PaymentRepository = {
    // deno-lint-ignore require-await
    search: async () => ok([]),
    // deno-lint-ignore require-await
    create: async () => ok(samplePayment),
  }

  const result = await createPaymentUseCase({
    userId: 1n,
    amount: 1200.5,
    date: "2024-01-10",
    note: null,
    categoryId: null,
  }, repository)

  assertEquals(result.isOk, false)
  if (!result.isOk) {
    assertEquals(result.error.type, "ValidationError")
    assertEquals(result.error.message, "Amount must be an integer")
  }
})

Deno.test("リポジトリエラーはそのまま返す", async () => {
  const repository: PaymentRepository = {
    // deno-lint-ignore require-await
    search: async () => ok([]),
    // deno-lint-ignore require-await
    create: async () => err(unexpectedError("boom")),
  }

  const result = await createPaymentUseCase({
    userId: 1n,
    amount: 1200,
    date: "2024-01-10",
    note: null,
    categoryId: null,
  }, repository)

  assertEquals(result.isOk, false)
  if (!result.isOk) {
    assertEquals(result.error.type, "UnexpectedError")
    assertEquals(result.error.message, "boom")
  }
})
