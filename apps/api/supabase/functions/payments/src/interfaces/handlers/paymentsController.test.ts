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
    searchUseCase: () => Promise.resolve(ok([])),
    createUseCase: () => Promise.resolve(ok(createSamplePayment())),
    createErrorResponse: () => new Response(null, { status: 500 }),
    jsonHeaders: JSON_HEADERS,
  }

  return createPaymentsController({ ...baseDeps, ...overrides })
}

const createPaymentRepositoryStub = (): PaymentRepository => {
  // deno-lint-ignore require-await
  const search: PaymentRepository["search"] = async () => {
    throw new Error("payment repository stub should not be called")
  }
  // deno-lint-ignore require-await
  const create: PaymentRepository["create"] = async () => {
    throw new Error("payment repository stub should not be called")
  }
  return { search, create }
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

Deno.test("支払い検索成功時に200で結果を返す", async () => {
  const supabase = {} as SupabaseClient<Database>
  const repo = createPaymentRepositoryStub()
  const payment = createSamplePayment()
  const payments: ReadonlyArray<Payment> = [payment]
  const paymentDtos: ReadonlyArray<PaymentDto> = payments.map(
    convertPaymentToDto,
  )
  const repositoryCalls: Array<{ supabase: SupabaseClient<Database> }> = []
  let receivedCriteria: {
    userId: number
    dateFrom?: string
    dateTo?: string
  } | undefined
  let receivedRepo: PaymentRepository | undefined

  const controller = createController({
    createRepository: (params) => {
      repositoryCalls.push(params)
      return repo
    },
    // deno-lint-ignore require-await
    searchUseCase: async (criteria, repository) => {
      receivedCriteria = criteria
      receivedRepo = repository
      return ok(payments)
    },
    createErrorResponse: () => {
      throw new Error("createErrorResponse should not be called")
    },
  })

  const response = await controller.search(
    supabase,
    1,
    "2024-01-01",
    "2024-01-31",
  )
  const body = await response.json()

  assertEquals(repositoryCalls, [{ supabase }])
  assertEquals(receivedRepo, repo)
  assertEquals(receivedCriteria, {
    userId: 1,
    dateFrom: "2024-01-01",
    dateTo: "2024-01-31",
  })
  assertEquals(response.status, 200)
  assertEquals(body, { payments: paymentDtos })
})

Deno.test("dateFromとdateToが未指定でも動作する", async () => {
  const supabase = {} as SupabaseClient<Database>
  const repo = createPaymentRepositoryStub()
  const payments: ReadonlyArray<Payment> = []
  let receivedCriteria: {
    userId: number
    dateFrom?: string
    dateTo?: string
  } | undefined

  const controller = createController({
    createRepository: () => repo,
    // deno-lint-ignore require-await
    searchUseCase: async (criteria) => {
      receivedCriteria = criteria
      return ok(payments)
    },
  })

  const response = await controller.search(supabase, 42)
  const body = await response.json()

  assertEquals(receivedCriteria, {
    userId: 42,
    dateFrom: undefined,
    dateTo: undefined,
  })
  assertEquals(response.status, 200)
  assertEquals(body, { payments })
})

Deno.test("ユースケースエラー時はcreateErrorResponseの結果を返す", async () => {
  const supabase = {} as SupabaseClient<Database>
  const repo = createPaymentRepositoryStub()
  const error: DomainError = { type: "UnexpectedError", message: "boom" }
  const errorResponse = new Response(JSON.stringify({ error: "boom" }), {
    status: 503,
  })
  const repositoryCalls: Array<{ supabase: SupabaseClient<Database> }> = []
  let receivedUseCaseRepo: PaymentRepository | undefined
  let receivedError: DomainError | z.ZodError | undefined

  const controller = createController({
    createRepository: (params) => {
      repositoryCalls.push(params)
      return repo
    },
    // deno-lint-ignore require-await
    searchUseCase: async (_criteria, repository) => {
      receivedUseCaseRepo = repository
      return err(error)
    },
    createErrorResponse: (givenError) => {
      receivedError = givenError
      return errorResponse
    },
  })

  const response = await controller.search(supabase, 1)
  const body = await response.json()

  assertEquals(repositoryCalls, [{ supabase }])
  assertEquals(receivedUseCaseRepo, repo)
  assertEquals(receivedError, error)
  assertEquals(response.status, 503)
  assertEquals(body, { error: "boom" })
})

Deno.test("成功レスポンスにJSONヘッダーを設定する", async () => {
  const client = {} as SupabaseClient<Database>
  const repository = createPaymentRepositoryStub()

  const controller = createController({
    createRepository: () => repository,
    // deno-lint-ignore require-await
    searchUseCase: async () => ok([]),
  })

  const response = await controller.search(client, 1)

  assertEquals(
    response.headers.get("content-type"),
    JSON_HEADERS["content-type"],
  )
})

Deno.test("dateFromが不正な形式の場合はValidationErrorを返す", async () => {
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

  const response = await controller.search(supabase, 1, "2024/01/01")
  const body = await response.json()

  assertEquals(receivedError instanceof z.ZodError, true)
  assertEquals(response.status, 400)
  assertEquals(body.fieldErrors.dateFrom.length, 1)
  assertEquals(body.fieldErrors.dateFrom[0], "Invalid ISO date")
})

Deno.test("dateToが不正な形式の場合はValidationErrorを返す", async () => {
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

  const response = await controller.search(
    supabase,
    1,
    "2024-01-01",
    "2024/01/31",
  )
  const body = await response.json()

  assertEquals(receivedError instanceof z.ZodError, true)
  assertEquals(response.status, 400)
  assertEquals(body.fieldErrors.dateTo.length, 1)
  assertEquals(body.fieldErrors.dateTo[0], "Invalid ISO date")
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
      return new Response(JSON.stringify({ message: error.message }), {
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

  assertEquals(receivedError?.type, "ValidationError")
  assertEquals(response.status, 400)
  assertEquals(body, { message: "amount must be a number" })
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
