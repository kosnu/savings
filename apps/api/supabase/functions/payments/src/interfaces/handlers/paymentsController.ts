import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../shared/types.ts"
import type { PaymentRepository } from "../../domain/repository.ts"
import { searchPaymentsUseCase } from "../../application/searchPaymentsUseCase.ts"
import { createSupabasePaymentRepository } from "../../infrastructure/paymentRepositoryImpl.ts"
import { createErrorResponse, JSON_HEADERS } from "./errorResponse.ts"

type PaymentsControllerDeps = {
  createRepository: (
    params: { supabase: SupabaseClient<Database> },
  ) => PaymentRepository
  searchUseCase: typeof searchPaymentsUseCase
  createErrorResponse: typeof createErrorResponse
  jsonHeaders: HeadersInit
}

export const createPaymentsController = (
  deps: PaymentsControllerDeps,
) => {
  const search = async (
    supabase: SupabaseClient<Database>,
    userId: bigint,
    dateFrom?: string,
    dateTo?: string,
  ) => {
    const repo = deps.createRepository({ supabase })
    const result = await deps.searchUseCase({ userId, dateFrom, dateTo }, repo)
    if (result.isOk) {
      return new Response(JSON.stringify({ payments: result.value }), {
        status: 200,
        headers: deps.jsonHeaders,
      })
    }

    return deps.createErrorResponse(result.error)
  }

  return { search }
}

export const paymentsController = createPaymentsController({
  createRepository: createSupabasePaymentRepository,
  searchUseCase: searchPaymentsUseCase,
  createErrorResponse,
  jsonHeaders: JSON_HEADERS,
})
