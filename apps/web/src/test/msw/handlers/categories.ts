import { type DelayMode, HttpResponse, delay, http } from "msw"
import * as z from "zod"

import type { CategoryRow } from "../../../types/category"
import type { PaymentRow } from "../../../types/payment"
import { otherBookFoodCat } from "../../data/categories"
import { payments } from "../../data/payments"
import { mapPaymentToRow } from "../../utils/mapPaymentToRow"

const CURRENT_BOOK_ID = 1

const REST_URL = "*/rest/v1/categories*"
const GET_EFFECTIVE_CATEGORY_BUDGETS_RPC_URL = "*/rest/v1/rpc/get_effective_category_budgets"
const initialPaymentRows: PaymentRow[] = payments.map(mapPaymentToRow)

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

export interface CategoryBudgetResponseRow {
  category_id: number
  status: "amount" | "none"
  amount: number | null
}

const initialCategoryBudgetRows: CategoryBudgetResponseRow[] = [
  {
    category_id: 10,
    status: "amount",
    amount: 30000,
  },
  {
    category_id: 20,
    status: "amount",
    amount: 4000,
  },
]

const getEffectiveCategoryBudgetsBodySchema = z.object({
  p_target_month: z.string(),
})

interface GetCategoriesHandlerOptions {
  response?: CategoryRow[]
  paymentRows?: PaymentRow[]
  budgetRows?: CategoryBudgetResponseRow[]
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

export function getEffectiveCategoryBudgetsHandler({
  budgetRows = initialCategoryBudgetRows,
  durationOrMode,
  error = false,
}: Pick<GetCategoriesHandlerOptions, "budgetRows" | "durationOrMode" | "error"> = {}) {
  return http.post(GET_EFFECTIVE_CATEGORY_BUDGETS_RPC_URL, async ({ request }) => {
    await delay(durationOrMode)

    if (error) {
      return HttpResponse.json({ message: "Failed to fetch category budgets." }, { status: 500 })
    }

    getEffectiveCategoryBudgetsBodySchema.parse(await request.json())

    return HttpResponse.json(budgetRows)
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

interface CreateCategoryHandlersOptions {
  get?: GetCategoriesHandlerOptions
}

export function createCategoryHandlers({ get = {} }: CreateCategoryHandlersOptions = {}) {
  return [getCategoriesHandler(get), getEffectiveCategoryBudgetsHandler(get)]
}

export const categoryHandlers = createCategoryHandlers()
