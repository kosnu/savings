import type { SupabaseClient } from "@supabase/supabase-js"
import { Payment } from "../domain/entities/payment.ts"
import { PaymentRepository, PaymentSearchParams } from "../domain/repository.ts"
import { Database } from "../shared/types.ts"
import { DomainError, unexpectedError } from "../shared/errors.ts"
import { err, ok, Result } from "../shared/result.ts"
import { mapRowToPayment } from "./utils/mapRowToPayment.ts"

type FetchPayments = (
  params: PaymentSearchParams,
) => Promise<Result<ReadonlyArray<Payment>, DomainError>>

type CreateFetchPayments = (
  supabase: SupabaseClient<Database>,
) => FetchPayments

const createFetchPayments: CreateFetchPayments =
  (supabase) => async ({ userId, dateFrom, dateTo }) => {
    let query = supabase
      .from("payments")
      .select(
        "id, note, amount, date, created_at, updated_at, category_id, user_id",
      )
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .order("id", { ascending: false })

    if (dateFrom !== undefined) {
      query = query.gte("date", dateFrom)
    }
    if (dateTo !== undefined) {
      query = query.lte("date", dateTo)
    }

    const { data, error } = await query
    if (error) {
      return err(unexpectedError("Failed to fetch payments", error))
    }

    const rows = data ?? []
    try {
      const payments = rows.map(mapRowToPayment)
      return ok(payments)
    } catch (e) {
      if (e instanceof Error) {
        return err(unexpectedError("Failed to map payment rows", e))
      }
      return err(
        unexpectedError(
          "Failed to map payment rows",
          new Error(String(e)),
        ),
      )
    }
  }

type CreatePaymentRepositoryParams = {
  fetchPayments: FetchPayments
}

const createPaymentRepository = (
  { fetchPayments }: CreatePaymentRepositoryParams,
): PaymentRepository => {
  const search: PaymentRepository["search"] = (params) => fetchPayments(params)

  return {
    search,
  }
}

type CreateSupabasePaymentRepositoryParams = {
  supabase: SupabaseClient<Database>
}

export const createSupabasePaymentRepository = (
  { supabase }: CreateSupabasePaymentRepositoryParams,
): PaymentRepository =>
  createPaymentRepository({
    fetchPayments: createFetchPayments(supabase),
  })
