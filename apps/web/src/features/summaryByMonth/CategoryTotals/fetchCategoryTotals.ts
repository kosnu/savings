import * as z from "zod"

import { toDateOnlyString } from "../../../domain/date"
import { getSupabaseClient } from "../../../lib/supabase"
import { unknownCategory } from "../../categories"

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
  budgetStatus: "amount" | "none" | "unset"
  budgetAmount: number | null
  budgetDifference: number | null
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

  const categoryBudgetsResponse = await supabase.rpc("get_effective_category_budgets", {
    p_target_month: toDateOnlyString(startDate ?? endDate ?? new Date()),
  })

  if (categoryBudgetsResponse.error) {
    throw categoryBudgetsResponse.error
  }

  const categoryBudgetMap = toCategoryBudgetMap(categoryBudgetsResponse.data)

  const categoryTotals = (categoryTotalsResponse.data ?? [])
    .map(normalizeCategoryTotalsRow)
    .map((row) => toCategoryTotal(row, categoryBudgetMap))
    .sort(compareCategoryTotals)

  const uncategorizedTotal: CategoryTotal = {
    key: "uncategorized",
    categoryId: null,
    categoryName: unknownCategory.name,
    totalAmount: (uncategorizedPaymentsResponse.data ?? [])
      .map(normalizeCategoryTotalsPaymentRow)
      .reduce((sum, payment) => sum + payment.amount, 0),
    budgetStatus: "unset",
    budgetAmount: null,
    budgetDifference: null,
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

function toCategoryTotal(
  row: CategoryTotalsRow,
  categoryBudgetMap: Map<number, CategoryBudgetState>,
): CategoryTotal {
  const totalAmount = row.payments.reduce((sum, payment) => sum + payment.amount, 0)
  const budgetState = categoryBudgetMap.get(row.id) ?? { status: "unset", amount: null }
  const budgetDifference =
    budgetState.status === "amount" && budgetState.amount !== null
      ? budgetState.amount - totalAmount
      : null

  return {
    key: `category:${row.id}`,
    categoryId: row.id,
    categoryName: row.name,
    totalAmount,
    budgetStatus: budgetState.status,
    budgetAmount: budgetState.amount,
    budgetDifference,
    pinned: (row.category_pins ?? []).some((pin) => pin.category_id === row.id),
    kind: "category",
  }
}

const effectiveCategoryBudgetSchema = z
  .object({
    category_id: z.number(),
    status: z.enum(["amount", "none"]),
    amount: z.number().nullable(),
  })
  .refine((value) => value.status !== "amount" || value.amount !== null)

type CategoryBudgetState = {
  status: "amount" | "none" | "unset"
  amount: number | null
}

function toCategoryBudgetMap(value: unknown): Map<number, CategoryBudgetState> {
  const result = z.array(effectiveCategoryBudgetSchema).safeParse(value)

  if (!result.success) {
    throw new Error("Invalid category budget response")
  }

  return new Map(
    result.data.map((budget) => [
      budget.category_id,
      {
        status: budget.status,
        amount: budget.status === "amount" ? budget.amount : null,
      },
    ]),
  )
}

function compareCategoryTotals(left: CategoryTotal, right: CategoryTotal): number {
  if (left.pinned !== right.pinned) {
    return left.pinned ? -1 : 1
  }

  return (
    (left.categoryId ?? Number.MAX_SAFE_INTEGER) - (right.categoryId ?? Number.MAX_SAFE_INTEGER)
  )
}
