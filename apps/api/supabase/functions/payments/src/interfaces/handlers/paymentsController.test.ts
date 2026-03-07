import { assertEquals } from "@std/assert"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../shared/types.ts"
import { createPaymentsController } from "./paymentsController.ts"
import { JSON_HEADERS } from "./errorResponse.ts"
import { err, ok } from "../../shared/result.ts"
import type { PaymentRepository } from "../../domain/repository.ts"
import type { DomainError } from "../../shared/errors.ts"
import { createPayment } from "../../domain/entities/payment.ts"
import type { Payment } from "../../domain/entities/payment.ts"
import { convertPaymentToDto, type PaymentDto } from "./paymentDto.ts"
import * as z from "@zod/zod"

type PaymentsControllerDeps = Parameters<
  typeof createPaymentsController
>[0]

const createController = (
  overrides: Partial<PaymentsControllerDeps>,
) => {
  const baseDeps: PaymentsControllerDeps = {
    createRepository: () => createPaymentRepositoryStub(),
    monthlyTotalUseCase: () => Promise.resolve(ok(0)),
    createUseCase: () => Promise.resolve(ok(createSamplePayment())),
    createErrorResponse: () => new Response(null, { status: 500 }),
    jsonHeaders: JSON_HEADERS,
  }

  return createPaymentsController({ ...baseDeps, ...overrides })
}

const createPaymentRepositoryStub = (): PaymentRepository => {
  // deno-lint-ignore require-await
  const create: PaymentRepository["create"] = async () => {
    throw new Error("payment repository stub should not be called")
  }
  // deno-lint-ignore require-await
  const monthlyTotal: PaymentRepository["monthlyTotal"] = async () => {
    throw new Error("payment repository stub should not be called")
  }
  return { monthlyTotal, create }
}

const createSamplePayment = () =>
  createPayment({
    id: 1,
    note: "ランチ",
    amount: 1200,
    date: new Date("2024-01-10"),
    createdAt: new Date("2024-01-11T00:00:00Z"),
    updatedAt: new Date("2024-01-11T00:00:00Z"),
    categoryId: 2,
    userId: 1,
  })

Deno.test("月次合計取得成功時に200で結果を返す", async () => {
  const supabase = {} as SupabaseClient<Database>
  const repo = createPaymentRepositoryStub()
  let receivedCriteria: { month: string } | undefined

  const controller = createController({
    createRepository: () => repo,
    // deno-lint-ignore require-await
    monthlyTotalUseCase: async (criteria) => {
      receivedCriteria = criteria
      return ok(3700)
    },
    createErrorResponse: () => {
      throw new Error("createErrorResponse should not be called")
    },
  })

  const response = await controller.monthlyTotal(supabase, "2024-01")
  const body = await response.json()

  assertEquals(receivedCriteria, { month: "2024-01" })
  assertEquals(response.status, 200)
  assertEquals(body, { totalAmount: 3700, month: "2024-01" })
})

Deno.test("month未指定の場合はValidationErrorを返す", async () => {
  const supabase = {} as SupabaseClient<Database>
  let receivedError: DomainError | z.ZodError | undefined

  const controller = createController({
    createRepository: () => {
      throw new Error("createRepository should not be called")
    },
    createErrorResponse: (error) => {
      receivedError = error
      const resBody = error instanceof z.ZodError
        ? z.flattenError(error)
        : { message: error.message }
      return new Response(JSON.stringify(resBody), {
        status: 400,
        headers: JSON_HEADERS,
      })
    },
  })

  const response = await controller.monthlyTotal(supabase)
  const body = await response.json()

  assertEquals(receivedError instanceof z.ZodError, true)
  assertEquals(response.status, 400)
  assertEquals(
    body.fieldErrors.month[0],
    "Invalid input: expected string, received undefined",
  )
})

Deno.test("month形式不正の場合はValidationErrorを返す", async () => {
  const supabase = {} as SupabaseClient<Database>
  let receivedError: DomainError | z.ZodError | undefined

  const controller = createController({
    createRepository: () => {
      throw new Error("createRepository should not be called")
    },
    createErrorResponse: (error) => {
      receivedError = error
      const resBody = error instanceof z.ZodError
        ? z.flattenError(error)
        : { message: error.message }
      return new Response(JSON.stringify(resBody), {
        status: 400,
        headers: JSON_HEADERS,
      })
    },
  })

  const response = await controller.monthlyTotal(supabase, "2024-13")
  const body = await response.json()

  assertEquals(receivedError instanceof z.ZodError, true)
  assertEquals(response.status, 400)
  assertEquals(body.fieldErrors.month.length, 1)
})

Deno.test("支払い作成成功時に201で結果を返す", async () => {
  const supabase = {} as SupabaseClient<Database>
  const repo = createPaymentRepositoryStub()
  const payment = createSamplePayment()
  const paymentDto = convertPaymentToDto(payment)
  let receivedParams:
    | {
      userId: number
      amount: number
      date: string
      note: string | null
      categoryId: number | null
    }
    | undefined

  const controller = createController({
    createRepository: () => repo,
    // deno-lint-ignore require-await
    createUseCase: async (params) => {
      receivedParams = params
      return ok(payment)
    },
    createErrorResponse: () => {
      throw new Error("createErrorResponse should not be called")
    },
  })

  const response = await controller.create(supabase, 1, {
    amount: 1200,
    date: "2024-01-10",
    note: "ランチ",
    categoryId: 2,
  })
  const body = await response.json()

  assertEquals(receivedParams, {
    userId: 1,
    amount: 1200,
    date: "2024-01-10",
    note: "ランチ",
    categoryId: 2,
  })
  assertEquals(response.status, 201)
  assertEquals(body, { payment: paymentDto })
})

Deno.test("支払い作成の入力が不正な場合はValidationErrorを返す", async () => {
  const supabase = {} as SupabaseClient<Database>
  let receivedError: DomainError | z.ZodError | undefined

  const controller = createController({
    createRepository: () => {
      throw new Error("createRepository should not be called")
    },
    createUseCase: () => {
      throw new Error("createUseCase should not be called")
    },
    createErrorResponse: (error) => {
      receivedError = error
      const resBody = error instanceof z.ZodError
        ? z.flattenError(error)
        : { message: error.message }
      return new Response(JSON.stringify(resBody), {
        status: 400,
        headers: JSON_HEADERS,
      })
    },
  })

  const response = await controller.create(supabase, 1, {
    amount: "1200",
    date: "2024-01-10",
  })
  const body = await response.json()

  assertEquals(receivedError instanceof z.ZodError, true)
  assertEquals(response.status, 400)
  assertEquals(body.fieldErrors.amount.length, 1)
})

Deno.test("支払い作成のユースケースエラーはcreateErrorResponseを返す", async () => {
  const supabase = {} as SupabaseClient<Database>
  const repo = createPaymentRepositoryStub()
  const error: DomainError = { type: "UnexpectedError", message: "boom" }
  let receivedError: DomainError | z.ZodError | undefined

  const controller = createController({
    createRepository: () => repo,
    // deno-lint-ignore require-await
    createUseCase: async () => err(error),
    createErrorResponse: (givenError) => {
      receivedError = givenError
      return new Response(JSON.stringify({ message: givenError.message }), {
        status: 500,
        headers: JSON_HEADERS,
      })
    },
  })

  const response = await controller.create(supabase, 1, {
    amount: 1200,
    date: "2024-01-10",
    note: null,
    categoryId: null,
  })
  const body = await response.json()

  assertEquals(receivedError, error)
  assertEquals(response.status, 500)
  assertEquals(body, { message: "boom" })
})
