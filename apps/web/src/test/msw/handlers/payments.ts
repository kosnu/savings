import { type DelayMode, HttpResponse, delay, http } from "msw"
import z from "zod"

import type { CategoryRow } from "../../../types/category"
import type { PaymentRow } from "../../../types/payment"
import { allCategories } from "../../data/categories"
import { payments } from "../../data/payments"
import { mapPaymentToRow } from "../../utils/mapPaymentToRow"

const REST_URL = "*/rest/v1/payments*"
const MONTHLY_TOTAL_AMOUNT_REST_URL = "*/rest/v1/rpc/get_monthly_total_amount"
const CURRENT_BOOK_ID = 1

const initialPaymentRows: PaymentRow[] = payments.map(mapPaymentToRow)
const initialCategoryRows: CategoryRow[] = allCategories.map((category) => ({
  id: category.id,
  book_id: category.bookId,
  name: category.name,
  created_at: category.createdDate.toISOString(),
  updated_at: category.updatedDate.toISOString(),
}))

interface PaymentDetailsRow extends PaymentRow {
  category: {
    id: number
    name: string
  } | null
}

interface BaseOptions {
  error?: boolean
  durationOrMode?: number | DelayMode | undefined
}

interface GetPaymentsOptions extends BaseOptions {
  response?: PaymentRow[]
}

interface CreatePaymentOptions extends BaseOptions {
  response?: PaymentRow
}

interface DeletePaymentOptions extends BaseOptions {
  response?: unknown
}

interface UpdatePaymentOptions extends BaseOptions {
  response?: unknown
}

interface GetMonthlyTotalAmountOptions extends BaseOptions {
  response?: number
}

interface CreatePaymentHandlersOptions {
  initialRows?: PaymentRow[]
  currentBookId?: number
  get?: GetPaymentsOptions
  create?: CreatePaymentOptions
  update?: UpdatePaymentOptions
  delete?: DeletePaymentOptions
  getMonthlyTotalAmount?: GetMonthlyTotalAmountOptions
}

function filterAndSortPayments(
  rows: PaymentRow[],
  request: Request,
  currentBookId: number,
): PaymentRow[] {
  const url = new URL(request.url)
  const dateFilters = url.searchParams.getAll("date")
  const idFilter = url.searchParams.get("id")
  const categoryIdFilter = url.searchParams.get("category_id")

  const from = dateFilters.find((value) => value.startsWith("gte."))?.replace("gte.", "")
  const to = dateFilters.find((value) => value.startsWith("lte."))?.replace("lte.", "")
  const id = idFilter?.startsWith("eq.") ? idFilter.replace("eq.", "") : null
  const uncategorized = categoryIdFilter === "is.null"

  return rows
    .filter((row) => row.book_id === currentBookId)
    .filter((row) => {
      if (id && String(row.id) !== id) {
        return false
      }
      if (uncategorized && row.category_id !== null) {
        return false
      }
      if (from && row.date < from) {
        return false
      }
      if (to && row.date > to) {
        return false
      }
      return true
    })
    .sort((a, b) => {
      if (b.date !== a.date) {
        return b.date < a.date ? -1 : 1
      }
      return b.id - a.id
    })
}

function shouldIncludeCategory(request: Request): boolean {
  const url = new URL(request.url)
  const select = url.searchParams.get("select")

  return select?.includes("category:categories") ?? false
}

function shouldReturnSingleObject(request: Request): boolean {
  const accept = request.headers.get("accept")

  return accept?.includes("application/vnd.pgrst.object+json") ?? false
}

function toPaymentDetailsRow(row: PaymentRow, categoryRows: CategoryRow[]): PaymentDetailsRow {
  const category = categoryRows.find(
    (candidate) => candidate.id === row.category_id && candidate.book_id === row.book_id,
  )

  return {
    id: row.id,
    note: row.note,
    amount: row.amount,
    date: row.date,
    created_at: row.created_at,
    updated_at: row.updated_at,
    book_id: row.book_id,
    category_id: row.category_id,
    category: category
      ? {
          id: category.id,
          name: category.name,
        }
      : null,
  }
}

const createPaymentBodySchema = z.object({
  amount: z.number(),
  date: z.string(),
  note: z.string().nullable(),
  category_id: z.number().nullable(),
})

type CreatePaymentBody = z.infer<typeof createPaymentBodySchema>

const updatePaymentBodySchema = z.object({
  amount: z.number().optional(),
  date: z.string().optional(),
  note: z.string().nullable().optional(),
  category_id: z.number().nullable().optional(),
})

const getMonthlyTotalAmountRequestBodySchema = z.object({
  p_month: z.string().optional(),
})

function buildPaymentRow(
  body: CreatePaymentBody,
  paymentRows: PaymentRow[],
  currentBookId: number,
): PaymentRow {
  const now = new Date().toISOString()

  return {
    id: Math.max(0, ...paymentRows.map((row) => row.id)) + 1,
    note: body.note,
    amount: body.amount,
    date: body.date,
    created_at: now,
    updated_at: now,
    book_id: currentBookId,
    category_id: body.category_id,
  }
}

function calculateMonthlyTotalAmount(
  paymentRows: PaymentRow[],
  currentBookId: number,
  month?: string,
): number {
  const currentBookPaymentRows = paymentRows.filter((row) => row.book_id === currentBookId)

  if (!month) {
    return currentBookPaymentRows.reduce((sum, row) => sum + row.amount, 0)
  }

  return currentBookPaymentRows
    .filter((row) => row.date.startsWith(`${month}-`))
    .reduce((sum, row) => sum + row.amount, 0)
}

export function createPaymentHandlers({
  initialRows = initialPaymentRows,
  currentBookId = CURRENT_BOOK_ID,
  get = {},
  create = {},
  update = {},
  delete: deleteOptions = {},
  getMonthlyTotalAmount = {},
}: CreatePaymentHandlersOptions = {}) {
  const categoryRows = [...initialCategoryRows]
  const rows = get.response ?? initialRows

  const getPaymentsHandler = http.get(REST_URL, async ({ request }) => {
    await delay(get.durationOrMode)

    if (get.error) {
      return HttpResponse.json({ message: "Failed to fetch payments." }, { status: 500 })
    }

    const filteredRows = filterAndSortPayments(rows, request, currentBookId)

    if (shouldIncludeCategory(request)) {
      const detailsRows = filteredRows.map((row) => toPaymentDetailsRow(row, categoryRows))

      if (shouldReturnSingleObject(request)) {
        return HttpResponse.json(detailsRows[0] ?? null)
      }

      return HttpResponse.json(detailsRows)
    }

    if (shouldReturnSingleObject(request)) {
      return HttpResponse.json(filteredRows[0] ?? null)
    }

    return HttpResponse.json(filteredRows)
  })

  const createPaymentHandler = http.post(REST_URL, async ({ request }) => {
    await delay(create.durationOrMode)

    if (create.error) {
      return HttpResponse.json({ message: "Failed to create payment." }, { status: 500 })
    }

    if (create.response) {
      return HttpResponse.json([create.response], { status: 201 })
    }

    const body = await request.json()
    const parsedBody = createPaymentBodySchema.parse(body)
    const newRow = buildPaymentRow(parsedBody, rows, currentBookId)

    return HttpResponse.json([newRow], { status: 201 })
  })

  const updatePaymentHandler = http.patch(REST_URL, async ({ request }) => {
    await delay(update.durationOrMode)

    if (update.error) {
      return HttpResponse.json({ message: "Failed to update payment." }, { status: 500 })
    }

    const body = await request.json()
    updatePaymentBodySchema.parse(body)

    return HttpResponse.json(update.response ?? { message: "Updated" })
  })

  const deletePaymentHandler = http.delete(REST_URL, async () => {
    await delay(deleteOptions.durationOrMode)

    if (deleteOptions.error) {
      return HttpResponse.json({ message: "Failed to delete payment." }, { status: 500 })
    }

    return HttpResponse.json(deleteOptions.response ?? { message: "Deleted" })
  })

  const getMonthlyTotalAmountHandler = http.post(
    MONTHLY_TOTAL_AMOUNT_REST_URL,
    async ({ request }) => {
      await delay(getMonthlyTotalAmount.durationOrMode)

      if (getMonthlyTotalAmount.error) {
        return HttpResponse.json(
          { message: "Failed to fetch monthly total amount." },
          { status: 500 },
        )
      }

      if (typeof getMonthlyTotalAmount.response === "number") {
        return HttpResponse.json(getMonthlyTotalAmount.response)
      }

      const body = await request.json()
      const parsedBody = getMonthlyTotalAmountRequestBodySchema.parse(body)
      return HttpResponse.json(calculateMonthlyTotalAmount(rows, currentBookId, parsedBody.p_month))
    },
  )

  return [
    getPaymentsHandler,
    createPaymentHandler,
    updatePaymentHandler,
    deletePaymentHandler,
    getMonthlyTotalAmountHandler,
  ]
}

export const paymentHandlers = createPaymentHandlers()
