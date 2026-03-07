import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "../../shared/types.ts"
import type { PaymentRepository } from "../../domain/repository.ts"
import { getMonthlyTotalUseCase } from "../../application/getMonthlyTotalUseCase.ts"
import { createSupabasePaymentRepository } from "../../infrastructure/paymentRepositoryImpl.ts"
import { createErrorResponse, JSON_HEADERS } from "./errorResponse.ts"
import { MonthCriteriaSchema } from "../monthCriteria.ts"

type PaymentsControllerDeps = {
  createRepository: (
    params: { supabase: SupabaseClient<Database> },
  ) => PaymentRepository
  monthlyTotalUseCase: typeof getMonthlyTotalUseCase
  createErrorResponse: typeof createErrorResponse
  jsonHeaders: HeadersInit
}

export const createPaymentsController = (
  deps: PaymentsControllerDeps,
) => {
  const monthlyTotal = async (
    supabase: SupabaseClient<Database>,
    month?: string,
  ) => {
    const criteria = MonthCriteriaSchema.safeParse({
      month,
    })
    if (!criteria.success) {
      return deps.createErrorResponse(criteria.error)
    }

    const repo = deps.createRepository({ supabase })
    const result = await deps.monthlyTotalUseCase(criteria.data, repo)
    if (result.isOk) {
      return new Response(
        JSON.stringify({
          totalAmount: result.value,
          month: criteria.data.month,
        }),
        {
          status: 200,
          headers: deps.jsonHeaders,
        },
      )
    }

    return deps.createErrorResponse(result.error)
  }

  return { monthlyTotal }
}

export const paymentsController = createPaymentsController({
  createRepository: createSupabasePaymentRepository,
  monthlyTotalUseCase: getMonthlyTotalUseCase,
  createErrorResponse,
  jsonHeaders: JSON_HEADERS,
})
