import * as z from "zod"

import { toDateOnlyString } from "../../../domain/date"
import { getSupabaseClient } from "../../../lib/supabase"
import { unknownCategory } from "../../categories/unknownCategory"

const categoryTotalsPaymentRowSchema = z.object({
  amount: z.number(),
  date: z.string(),
})

const categoryTotalsRowSchema = z.object({
  id: z.number(),
  name: z.string(),
  category_pins: z
    .array(
      z.object({
        id: z.number(),
        category_id: z.number(),
      }),
    )
    .nullable(),
  payments: z.array(categoryTotalsPaymentRowSchema),
})

type CategoryTotalsRow = z.infer<typeof categoryTotalsRowSchema>
type CategoryTotalsPaymentRow = z.infer<typeof categoryTotalsPaymentRowSchema>

export interface CategoryTotal {
  key: string
  categoryId: number | null
  categoryName: string
  totalAmount: number
  pinned: boolean
  kind: "category" | "uncategorized"
}

export type CategoryTotals = CategoryTotal[]

const categoryTotalsColumns = `
  id,
  name,
  category_pins:category_pins!category_pins_category_id_fkey (
    id,
    category_id
  ),
  payments:payments!payments_category_id_fkey (
    amount,
    date
  )
`

export async function fetchCategoryTotals([startDate, endDate]: [
  Date | null,
  Date | null,
]): Promise<CategoryTotals> {
  const supabase = getSupabaseClient()
  let categoryTotalsQuery = supabase.from("categories").select(categoryTotalsColumns).order("id", {
    ascending: true,
  })
  let uncategorizedPaymentsQuery = supabase
    .from("payments")
    .select("amount, date")
    .is("category_id", null)

  if (startDate) {
    const formattedStartDate = toDateOnlyString(startDate)
    categoryTotalsQuery = categoryTotalsQuery.gte("payments.date", formattedStartDate)
    uncategorizedPaymentsQuery = uncategorizedPaymentsQuery.gte("date", formattedStartDate)
  }
  if (endDate) {
    const formattedEndDate = toDateOnlyString(endDate)
    categoryTotalsQuery = categoryTotalsQuery.lte("payments.date", formattedEndDate)
    uncategorizedPaymentsQuery = uncategorizedPaymentsQuery.lte("date", formattedEndDate)
  }

  const [categoryTotalsResponse, uncategorizedPaymentsResponse] = await Promise.all([
    categoryTotalsQuery,
    uncategorizedPaymentsQuery,
  ])

  if (categoryTotalsResponse.error) {
    throw categoryTotalsResponse.error
  }
  if (uncategorizedPaymentsResponse.error) {
    throw uncategorizedPaymentsResponse.error
  }

  const categoryTotals = (categoryTotalsResponse.data ?? [])
    .map(normalizeCategoryTotalsRow)
    .map(toCategoryTotal)
    .sort(compareCategoryTotals)

  const uncategorizedTotal: CategoryTotal = {
    key: "uncategorized",
    categoryId: null,
    categoryName: unknownCategory.name,
    totalAmount: (uncategorizedPaymentsResponse.data ?? [])
      .map(normalizeCategoryTotalsPaymentRow)
      .reduce((sum, payment) => sum + payment.amount, 0),
    pinned: false,
    kind: "uncategorized",
  }

  return [...categoryTotals, uncategorizedTotal]
}

function normalizeCategoryTotalsRow(value: unknown): CategoryTotalsRow {
  const result = categoryTotalsRowSchema.safeParse(value)

  if (!result.success) {
    throw new Error("Invalid category totals response")
  }

  return result.data
}

function normalizeCategoryTotalsPaymentRow(value: unknown): CategoryTotalsPaymentRow {
  const result = categoryTotalsPaymentRowSchema.safeParse(value)

  if (!result.success) {
    throw new Error("Invalid category totals response")
  }

  return result.data
}

function toCategoryTotal(row: CategoryTotalsRow): CategoryTotal {
  return {
    key: `category:${row.id}`,
    categoryId: row.id,
    categoryName: row.name,
    totalAmount: row.payments.reduce((sum, payment) => sum + payment.amount, 0),
    pinned: (row.category_pins ?? []).some((pin) => pin.category_id === row.id),
    kind: "category",
  }
}

function compareCategoryTotals(left: CategoryTotal, right: CategoryTotal): number {
  if (left.pinned !== right.pinned) {
    return left.pinned ? -1 : 1
  }

  return (
    (left.categoryId ?? Number.MAX_SAFE_INTEGER) - (right.categoryId ?? Number.MAX_SAFE_INTEGER)
  )
}
