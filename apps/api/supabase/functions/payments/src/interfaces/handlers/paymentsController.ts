import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../shared/types.ts"
import type { PaymentRepository } from "../../domain/repository.ts"
import { searchPaymentsUseCase } from "../../application/searchPaymentsUseCase.ts"
import { createPaymentUseCase } from "../../application/createPaymentUseCase.ts"
import { convertPaymentToDto } from "./paymentDto.ts"
import { createSupabasePaymentRepository } from "../../infrastructure/paymentRepositoryImpl.ts"
import { createErrorResponse, JSON_HEADERS } from "./errorResponse.ts"
import { validateCriteria } from "./validateCriteria.ts"
import { validateCreatePaymentInput } from "./validateCreatePaymentInput.ts"

type PaymentsControllerDeps = {
  createRepository: (
    params: { supabase: SupabaseClient<Database> },
  ) => PaymentRepository
  searchUseCase: typeof searchPaymentsUseCase
  createUseCase: typeof createPaymentUseCase
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
    const validation = validateCriteria(dateFrom, dateTo)
    if (validation) {
      return deps.createErrorResponse(validation)
    }
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

  const create = async (
    supabase: SupabaseClient<Database>,
    userId: bigint,
    input: unknown,
  ) => {
    const parsed = validateCreatePaymentInput(input)
    if (!parsed.isOk) {
      return deps.createErrorResponse(parsed.error)
    }

    const repo = deps.createRepository({ supabase })
    const result = await deps.createUseCase(
      { ...parsed.value, userId },
      repo,
    )
    if (result.isOk) {
      const payment = convertPaymentToDto(result.value)
      return new Response(JSON.stringify({ payment }), {
        status: 201,
        headers: deps.jsonHeaders,
      })
    }

    return deps.createErrorResponse(result.error)
  }

  return { search, create }
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
  createUseCase: createPaymentUseCase,
  createErrorResponse,
  jsonHeaders: JSON_HEADERS,
})
