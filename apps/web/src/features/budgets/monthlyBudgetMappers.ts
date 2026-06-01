import * as z from "zod"

import { parseDateOnlyStringToLocalDate } from "../../domain/date"
import type { MonthlyBudget, MonthlyBudgetState } from "./types"

const monthlyBudgetRowSchema = z.object({
  id: z.number(),
  book_id: z.number(),
  amount: z.number().nullable(),
  effective_from: z.string(),
  effective_year: z.number(),
  effective_month: z.number(),
  status: z.enum(["amount", "none"]),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
})

type NormalizedMonthlyBudgetRow = z.infer<typeof monthlyBudgetRowSchema>

const effectiveMonthlyBudgetResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("amount"),
    monthly_budget: monthlyBudgetRowSchema,
  }),
  z.object({
    status: z.literal("none"),
    monthly_budget: z.null(),
  }),
  z.object({
    status: z.literal("unset"),
    monthly_budget: z.null(),
  }),
])

type EffectiveMonthlyBudgetResponse = z.infer<typeof effectiveMonthlyBudgetResponseSchema>

export function normalizeMonthlyBudgetRow(value: unknown): NormalizedMonthlyBudgetRow {
  const result = monthlyBudgetRowSchema.safeParse(value)

  if (!result.success) {
    throw new Error("Invalid monthly budget response")
  }

  return result.data
}

export function normalizeMonthlyBudgetRows(value: unknown): NormalizedMonthlyBudgetRow[] {
  const result = z.array(monthlyBudgetRowSchema).safeParse(value)

  if (!result.success) {
    throw new Error("Invalid monthly budget response")
  }

  return result.data
}

export function normalizeEffectiveMonthlyBudgetResponse(
  value: unknown,
): EffectiveMonthlyBudgetResponse {
  const result = effectiveMonthlyBudgetResponseSchema.safeParse(value)

  if (!result.success) {
    throw new Error("Invalid monthly budget response")
  }

  return result.data
}

export function toMonthlyBudget(row: NormalizedMonthlyBudgetRow): MonthlyBudget {
  if (row.status !== "amount" || row.amount === null) {
    throw new Error("Invalid monthly budget response")
  }

  return {
    id: row.id,
    bookId: row.book_id,
    amount: row.amount,
    effectiveFrom: parseDateOnlyStringToLocalDate(row.effective_from),
    effectiveYear: row.effective_year,
    effectiveMonth: row.effective_month,
    status: row.status,
    createdDate: row.created_at ? new Date(row.created_at) : new Date(),
    updatedDate: row.updated_at ? new Date(row.updated_at) : new Date(),
  }
}

export function toMonthlyBudgetState(response: EffectiveMonthlyBudgetResponse): MonthlyBudgetState {
  if (response.status === "amount") {
    return {
      status: "amount",
      monthlyBudget: toMonthlyBudget(response.monthly_budget),
    }
  }

  return {
    status: response.status,
    monthlyBudget: null,
  }
}
