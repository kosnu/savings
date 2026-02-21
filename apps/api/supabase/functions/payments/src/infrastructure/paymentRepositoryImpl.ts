import type { SupabaseClient } from "@supabase/supabase-js"
import { Payment } from "../domain/entities/payment.ts"
import {
  PaymentCreateParams,
  PaymentMonthlyTotalParams,
  PaymentRepository,
  PaymentSearchParams,
} from "../domain/repository.ts"
import { Database } from "../shared/types.ts"
import { DomainError, unexpectedError } from "../shared/errors.ts"
import { err, ok, Result } from "../shared/result.ts"
import { mapRowToPayment } from "./utils/mapRowToPayment.ts"

type PaymentInsert = Database["public"]["Tables"]["payments"]["Insert"]

type FetchPayments = (
  params: PaymentSearchParams,
) => Promise<Result<ReadonlyArray<Payment>, DomainError>>

type CreatePayment = (
  params: PaymentCreateParams,
) => Promise<Result<Payment, DomainError>>

type FetchMonthlyTotal = (
  params: PaymentMonthlyTotalParams,
) => Promise<Result<number, DomainError>>

type CreateFetchPayments = (
  supabase: SupabaseClient<Database>,
) => FetchPayments

type CreateInsertPayment = (
  supabase: SupabaseClient<Database>,
) => CreatePayment

type CreateFetchMonthlyTotal = (
  supabase: SupabaseClient<Database>,
) => FetchMonthlyTotal

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
  (supabase) => async ({ userId, month }) => {
    const { data, error } = await supabase.rpc("get_monthly_total_amount", {
      p_user_id: userId,
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
  fetchPayments: FetchPayments
  fetchMonthlyTotal: FetchMonthlyTotal
  insertPayment: CreatePayment
}

const createPaymentRepository = (
  { fetchPayments, fetchMonthlyTotal, insertPayment }:
    CreatePaymentRepositoryParams,
): PaymentRepository => {
  const search: PaymentRepository["search"] = (params) => fetchPayments(params)
  const monthlyTotal: PaymentRepository["monthlyTotal"] = (params) =>
    fetchMonthlyTotal(params)
  const create: PaymentRepository["create"] = (params) => insertPayment(params)

  return {
    search,
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
    fetchPayments: createFetchPayments(supabase),
    fetchMonthlyTotal: createFetchMonthlyTotal(supabase),
    insertPayment: createInsertPayment(supabase),
  })
