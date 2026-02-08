import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../shared/types.ts"
import type { PaymentRepository } from "../../domain/repository.ts"
import { searchPaymentsUseCase } from "../../application/searchPaymentsUseCase.ts"
import { convertPaymentToDto } from "./paymentDto.ts"
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
    const criteria = buildSearchCriteria(userId, dateFrom, dateTo)
    const result = await deps.searchUseCase(criteria, repo)
    if (result.isOk) {
      const payments = result.value.map(convertPaymentToDto)
      return new Response(JSON.stringify({ payments }), {
        status: 200,
        headers: deps.jsonHeaders,
      })
    }

    return deps.createErrorResponse(result.error)
  }

  return { search }
}

type PaymentSearchCriteria = {
  userId: bigint
  dateFrom?: string
  dateTo?: string
}

function buildSearchCriteria(
  userId: bigint,
  dateFrom?: string,
  dateTo?: string,
): PaymentSearchCriteria {
  const criteria: PaymentSearchCriteria = { userId }

  if (dateFrom !== undefined) {
    criteria.dateFrom = dateFrom
  }
  if (dateTo !== undefined) {
    criteria.dateTo = dateTo
  }

  return criteria
}

export const paymentsController = createPaymentsController({
  createRepository: createSupabasePaymentRepository,
  searchUseCase: searchPaymentsUseCase,
  createErrorResponse,
  jsonHeaders: JSON_HEADERS,
})
