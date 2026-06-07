import { type DelayMode, HttpResponse, delay, http } from "msw"
import * as z from "zod"

import type { CategoryRow } from "../../../types/category"
import type { PaymentRow } from "../../../types/payment"
import { otherBookFoodCat } from "../../data/categories"
import { payments } from "../../data/payments"
import { mapPaymentToRow } from "../../utils/mapPaymentToRow"

const CURRENT_BOOK_ID = 1

const REST_URL = "*/rest/v1/categories*"
const CATEGORY_TOTALS_WITH_BUDGETS_RPC_URL = "*/rest/v1/rpc/get_category_totals_with_budgets"
const initialPaymentRows: PaymentRow[] = payments.map(mapPaymentToRow)

const categoryTotalsWithBudgetsRequestBodySchema = z.object({
  p_start_date: z.string().optional(),
  p_end_date: z.string().optional(),
})

type CategoryTotalsWithBudgetsRequestBody = z.infer<
  typeof categoryTotalsWithBudgetsRequestBodySchema
>

const initialCategoryRows: CategoryRow[] = [
  {
    id: 10,
    book_id: 1,
    name: "Food",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  },
  {
    id: 20,
    book_id: 1,
    name: "Daily Necessities",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  },
  {
    id: 30,
    book_id: 1,
    name: "Entertainment",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  },
  {
    id: otherBookFoodCat.id,
    book_id: otherBookFoodCat.bookId,
    name: otherBookFoodCat.name,
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2025-01-01T00:00:00.000Z",
  },
]

interface GetCategoriesHandlerOptions {
  response?: CategoryRow[]
  paymentRows?: PaymentRow[]
  pinnedCategoryIds?: number[]
  currentBookId?: number
  durationOrMode?: number | DelayMode | undefined
  error?: boolean
  errorOnce?: boolean
}

export function getCategoriesHandler({
  response = initialCategoryRows,
  paymentRows = initialPaymentRows,
  pinnedCategoryIds = [10],
  currentBookId = CURRENT_BOOK_ID,
  durationOrMode,
  error = false,
  errorOnce = false,
}: GetCategoriesHandlerOptions = {}) {
  let hasErrored = false

  return http.get(REST_URL, async ({ request }) => {
    await delay(durationOrMode)

    if (error || (errorOnce && !hasErrored)) {
      hasErrored = true
      return HttpResponse.json({ message: "Failed to fetch categories." }, { status: 500 })
    }

    const currentBookCategoryRows = response.filter((row) => row.book_id === currentBookId)

    if (shouldIncludePayments(request)) {
      return HttpResponse.json(
        currentBookCategoryRows.map((category) =>
          toCategoryTotalsRow(category, paymentRows, request, currentBookId, pinnedCategoryIds),
        ),
      )
    }

    return HttpResponse.json(currentBookCategoryRows)
  })
}

export function getCategoryTotalsWithBudgetsHandler({
  response = initialCategoryRows,
  paymentRows = initialPaymentRows,
  pinnedCategoryIds = [10],
  currentBookId = CURRENT_BOOK_ID,
  durationOrMode,
  error = false,
  errorOnce = false,
}: GetCategoriesHandlerOptions = {}) {
  let hasErrored = false

  return http.post(CATEGORY_TOTALS_WITH_BUDGETS_RPC_URL, async ({ request }) => {
    await delay(durationOrMode)

    if (error || (errorOnce && !hasErrored)) {
      hasErrored = true
      return HttpResponse.json({ message: "Failed to fetch categories." }, { status: 500 })
    }

    const body = categoryTotalsWithBudgetsRequestBodySchema.parse(await request.json())
    const currentBookCategoryRows = response.filter((row) => row.book_id === currentBookId)
    const categoryRows = currentBookCategoryRows.map((category) =>
      toCategoryTotalsRpcRow(category, paymentRows, body, currentBookId, pinnedCategoryIds),
    )
    const uncategorizedTotal = paymentRows
      .filter((payment) => payment.book_id === currentBookId)
      .filter((payment) => payment.category_id === null)
      .filter((payment) => isPaymentInRange(payment, body.p_start_date, body.p_end_date))
      .reduce((sum, payment) => sum + payment.amount, 0)

    return HttpResponse.json([
      ...categoryRows.sort((left, right) => {
        if (left.pinned !== right.pinned) return left.pinned ? -1 : 1
        return (
          (left.category_id ?? Number.MAX_SAFE_INTEGER) -
          (right.category_id ?? Number.MAX_SAFE_INTEGER)
        )
      }),
      {
        category_id: null,
        category_name: "Unknown",
        total_amount: uncategorizedTotal,
        pinned: false,
        budget_state: "unset",
        budget_amount: null,
        kind: "uncategorized",
      },
    ])
  })
}

function shouldIncludePayments(request: Request): boolean {
  const select = new URL(request.url).searchParams.get("select")

  return select?.includes("payments:payments") ?? false
}

function toCategoryTotalsRow(
  category: CategoryRow,
  paymentRows: PaymentRow[],
  request: Request,
  currentBookId: number,
  pinnedCategoryIds: number[],
) {
  const url = new URL(request.url)
  const dateFilters = url.searchParams.getAll("payments.date")
  const from = dateFilters.find((value) => value.startsWith("gte."))?.replace("gte.", "")
  const to = dateFilters.find((value) => value.startsWith("lte."))?.replace("lte.", "")
  const payments = paymentRows
    .filter((payment) => payment.book_id === currentBookId)
    .filter((payment) => payment.category_id === category.id)
    .filter((payment) => {
      if (from && payment.date < from) return false
      if (to && payment.date > to) return false
      return true
    })
    .map((payment) => ({
      amount: payment.amount,
      date: payment.date,
    }))

  return {
    id: category.id,
    name: category.name,
    category_pins: pinnedCategoryIds.includes(category.id)
      ? [
          {
            id: category.id,
            category_id: category.id,
          },
        ]
      : [],
    payments,
  }
}

function toCategoryTotalsRpcRow(
  category: CategoryRow,
  paymentRows: PaymentRow[],
  body: CategoryTotalsWithBudgetsRequestBody,
  currentBookId: number,
  pinnedCategoryIds: number[],
) {
  const payments = paymentRows
    .filter((payment) => payment.book_id === currentBookId)
    .filter((payment) => payment.category_id === category.id)
    .filter((payment) => isPaymentInRange(payment, body.p_start_date, body.p_end_date))

  return {
    category_id: category.id,
    category_name: category.name,
    total_amount: payments.reduce((sum, payment) => sum + payment.amount, 0),
    pinned: pinnedCategoryIds.includes(category.id),
    budget_state: category.id === 10 ? "amount" : category.id === 20 ? "none" : "unset",
    budget_amount: category.id === 10 ? 20000 : null,
    kind: "category",
  }
}

function isPaymentInRange(payment: PaymentRow, from?: string, to?: string): boolean {
  if (from && payment.date < from) return false
  if (to && payment.date > to) return false
  return true
}

interface CreateCategoryHandlersOptions {
  get?: GetCategoriesHandlerOptions
}

export function createCategoryHandlers({ get = {} }: CreateCategoryHandlersOptions = {}) {
  return [getCategoriesHandler(get), getCategoryTotalsWithBudgetsHandler(get)]
}

export const categoryHandlers = createCategoryHandlers()
