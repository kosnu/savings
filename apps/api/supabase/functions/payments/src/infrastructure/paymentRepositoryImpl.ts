import type { SupabaseClient } from "@supabase/supabase-js"
import { Payment } from "../domain/entities/payment.ts"
import {
  PaymentCreateParams,
  PaymentMonthlyTotalParams,
  PaymentRepository,
} from "../domain/repository.ts"
import { Database } from "../shared/types.ts"
import { DomainError, unexpectedError } from "../shared/errors.ts"
import { err, ok, Result } from "../shared/result.ts"
import { mapRowToPayment } from "./utils/mapRowToPayment.ts"

type PaymentInsert = Database["public"]["Tables"]["payments"]["Insert"]

type CreatePayment = (
  params: PaymentCreateParams,
) => Promise<Result<Payment, DomainError>>

type FetchMonthlyTotal = (
  params: PaymentMonthlyTotalParams,
) => Promise<Result<number, DomainError>>

type CreateInsertPayment = (
  supabase: SupabaseClient<Database>,
) => CreatePayment

type CreateFetchMonthlyTotal = (
  supabase: SupabaseClient<Database>,
) => FetchMonthlyTotal

const createInsertPayment: CreateInsertPayment =
  (supabase) => async ({ userId, amount, date, note, categoryId }) => {
    const payload: PaymentInsert = {
      user_id: userId.value,
      amount: amount.value,
      date: toDateString(date.value),
      note: note.value,
      category_id: categoryId === null ? null : categoryId.value,
    }

    const { data, error } = await supabase
      .from("payments")
      .insert(payload)
      .select(
        "id, note, amount, date, created_at, updated_at, category_id, user_id",
      )
      .single()

    if (error) {
      return err(unexpectedError("Failed to create payment", error))
    }

    try {
      return ok(mapRowToPayment(data))
    } catch (e) {
      if (e instanceof Error) {
        return err(unexpectedError("Failed to map payment row", e))
      }
      return err(
        unexpectedError(
          "Failed to map payment row",
          new Error(String(e)),
        ),
      )
    }
  }

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

const toDateString = (value: Date): string => value.toISOString().slice(0, 10)

type CreatePaymentRepositoryParams = {
  fetchMonthlyTotal: FetchMonthlyTotal
  insertPayment: CreatePayment
}

const createPaymentRepository = (
  { fetchMonthlyTotal, insertPayment }:
    CreatePaymentRepositoryParams,
): PaymentRepository => {
  const monthlyTotal: PaymentRepository["monthlyTotal"] = (params) =>
    fetchMonthlyTotal(params)
  const create: PaymentRepository["create"] = (params) => insertPayment(params)

  return {
    monthlyTotal,
    create,
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
    insertPayment: createInsertPayment(supabase),
  })
