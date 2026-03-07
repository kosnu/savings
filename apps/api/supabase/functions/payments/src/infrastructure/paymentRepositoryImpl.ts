import type { SupabaseClient } from "@supabase/supabase-js"
import {
  PaymentMonthlyTotalParams,
  PaymentRepository,
} from "../domain/repository.ts"
import { Database } from "../shared/types.ts"
import { DomainError, unexpectedError } from "../shared/errors.ts"
import { err, ok, Result } from "../shared/result.ts"

type FetchMonthlyTotal = (
  params: PaymentMonthlyTotalParams,
) => Promise<Result<number, DomainError>>

type CreateFetchMonthlyTotal = (
  supabase: SupabaseClient<Database>,
) => FetchMonthlyTotal

const createFetchMonthlyTotal: CreateFetchMonthlyTotal =
  (supabase) => async ({ month }) => {
    const { data, error } = await supabase.rpc("get_monthly_total_amount", {
      p_month: month,
    })

    if (error) {
      return err(unexpectedError("Failed to fetch monthly total", error))
    }

    const totalAmount = data == null ? 0 : Number(data)
    if (!Number.isFinite(totalAmount)) {
      return err(
        unexpectedError(
          "Failed to convert monthly total amount",
          new Error(String(data)),
        ),
      )
    }
    return ok(totalAmount)
  }

type CreatePaymentRepositoryParams = {
  fetchMonthlyTotal: FetchMonthlyTotal
}

const createPaymentRepository = (
  { fetchMonthlyTotal }: CreatePaymentRepositoryParams,
): PaymentRepository => {
  const monthlyTotal: PaymentRepository["monthlyTotal"] = (params) =>
    fetchMonthlyTotal(params)

  return {
    monthlyTotal,
  }
}

type CreateSupabasePaymentRepositoryParams = {
  supabase: SupabaseClient<Database>
}

export const createSupabasePaymentRepository = (
  { supabase }: CreateSupabasePaymentRepositoryParams,
): PaymentRepository =>
  createPaymentRepository({
    fetchMonthlyTotal: createFetchMonthlyTotal(supabase),
  })
