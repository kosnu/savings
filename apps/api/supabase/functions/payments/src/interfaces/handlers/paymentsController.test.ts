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

type PaymentsControllerDeps = Parameters<
  typeof createPaymentsController
>[0]

const createController = (
  overrides: Partial<PaymentsControllerDeps>,
) => {
  const baseDeps: PaymentsControllerDeps = {
    createRepository: () => createPaymentRepositoryStub(),
    searchUseCase: () => Promise.resolve(ok([])),
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
  return { search }
}

Deno.test("支払い検索成功時に200で結果を返す", async () => {
  const supabase = {} as SupabaseClient<Database>
  const repo = createPaymentRepositoryStub()
  const payment = createPayment({
    id: 1n,
    note: "ランチ",
    amount: 1200,
    date: new Date("2024-01-10"),
    createdAt: new Date("2024-01-11T00:00:00Z"),
    updatedAt: new Date("2024-01-11T00:00:00Z"),
    categoryId: 2n,
    userId: 1n,
  })
  const payments: ReadonlyArray<Payment> = [payment]
  const repositoryCalls: Array<{ supabase: SupabaseClient<Database> }> = []
  let receivedCriteria: {
    userId: bigint
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
    1n,
    "2024-01-01",
    "2024-01-31",
  )
  const body = await response.json()

  assertEquals(repositoryCalls, [{ supabase }])
  assertEquals(receivedRepo, repo)
  assertEquals(receivedCriteria, {
    userId: 1n,
    dateFrom: "2024-01-01",
    dateTo: "2024-01-31",
  })
  assertEquals(response.status, 200)
  assertEquals(body, { payments })
})

Deno.test("dateFromとdateToが未指定でも動作する", async () => {
  const supabase = {} as SupabaseClient<Database>
  const repo = createPaymentRepositoryStub()
  const payments: ReadonlyArray<Payment> = []
  let receivedCriteria: {
    userId: bigint
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

  const response = await controller.search(supabase, 42n)
  const body = await response.json()

  assertEquals(receivedCriteria, { userId: 42n })
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
  let receivedError: DomainError | undefined

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

  const response = await controller.search(supabase, 1n)
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

  const response = await controller.search(client, 1n)

  assertEquals(
    response.headers.get("content-type"),
    JSON_HEADERS["content-type"],
  )
})
