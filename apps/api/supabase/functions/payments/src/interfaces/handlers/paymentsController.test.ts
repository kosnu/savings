import { assertEquals } from "@std/assert"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../shared/types.ts"
import { createPaymentsController } from "./paymentsController.ts"
import { JSON_HEADERS } from "./errorResponse.ts"
import { ok } from "../../shared/result.ts"
import type { PaymentRepository } from "../../domain/repository.ts"
import type { DomainError } from "../../shared/errors.ts"
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
    createErrorResponse: () => new Response(null, { status: 500 }),
    jsonHeaders: JSON_HEADERS,
  }

  return createPaymentsController({ ...baseDeps, ...overrides })
}

const createPaymentRepositoryStub = (): PaymentRepository => {
  // deno-lint-ignore require-await
  const monthlyTotal: PaymentRepository["monthlyTotal"] = async () => {
    throw new Error("payment repository stub should not be called")
  }
  return { monthlyTotal }
}

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
