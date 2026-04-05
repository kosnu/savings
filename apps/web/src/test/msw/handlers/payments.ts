import { DelayMode, HttpResponse, delay, http } from "msw"

import type { CategoryRow } from "../../../types/category"
import type { PaymentRow } from "../../../types/payment"
import { categories } from "../../data/categories"
import { payments } from "../../data/payments"
import { mapPaymentToRow } from "../../utils/mapPaymentToRow"

const REST_URL = "*/rest/v1/payments*"
const MONTHLY_TOTAL_AMOUNT_REST_URL = "*/rest/v1/rpc/get_monthly_total_amount"

const initialPaymentRows: PaymentRow[] = payments.map(mapPaymentToRow)
const initialCategoryRows: CategoryRow[] = categories.map((category) => ({
  id: category.id,
  name: category.name,
  created_at: category.createdDate.toISOString(),
  updated_at: category.updatedDate.toISOString(),
}))

interface PaymentDetailsRow extends Omit<PaymentRow, "category_id"> {
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
  get?: GetPaymentsOptions
  create?: CreatePaymentOptions
  update?: UpdatePaymentOptions
  delete?: DeletePaymentOptions
  getMonthlyTotalAmount?: GetMonthlyTotalAmountOptions
}

function filterAndSortPayments(rows: PaymentRow[], request: Request): PaymentRow[] {
  const url = new URL(request.url)
  const dateFilters = url.searchParams.getAll("date")
  const idFilter = url.searchParams.get("id")

  const from = dateFilters.find((value) => value.startsWith("gte."))?.replace("gte.", "")
  const to = dateFilters.find((value) => value.startsWith("lte."))?.replace("lte.", "")
  const id = idFilter?.startsWith("eq.") ? idFilter.replace("eq.", "") : null

  return rows
    .filter((row) => {
      if (id && String(row.id) !== id) {
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
  const category = categoryRows.find((candidate) => candidate.id === row.category_id)

  return {
    id: row.id,
    note: row.note,
    amount: row.amount,
    date: row.date,
    created_at: row.created_at,
    updated_at: row.updated_at,
    user_id: row.user_id,
    category: category
      ? {
          id: category.id,
          name: category.name,
        }
      : null,
  }
}

function buildPaymentRow(body: Record<string, unknown>, paymentRows: PaymentRow[]): PaymentRow {
  const now = new Date().toISOString()

  return {
    id: Math.max(0, ...paymentRows.map((row) => row.id)) + 1,
    note: (body.note as string) ?? null,
    amount: body.amount as number,
    date: body.date as string,
    created_at: now,
    updated_at: now,
    category_id:
      body.category_id !== null && body.category_id !== undefined ? Number(body.category_id) : null,
    user_id: 100,
  }
}

function extractPaymentId(request: Request): string | null {
  const url = new URL(request.url)
  const idFromQuery = url.searchParams.get("id")

  if (idFromQuery) {
    return idFromQuery.replace(/^eq\./, "")
  }

  return url.pathname.split("/").pop() ?? null
}

function calculateMonthlyTotalAmount(paymentRows: PaymentRow[], month?: string): number {
  if (!month) {
    return paymentRows.reduce((sum, row) => sum + row.amount, 0)
  }

  return paymentRows
    .filter((row) => row.date.startsWith(`${month}-`))
    .reduce((sum, row) => sum + row.amount, 0)
}

export function createPaymentHandlers({
  initialRows = initialPaymentRows,
  get = {},
  create = {},
  update = {},
  delete: deleteOptions = {},
  getMonthlyTotalAmount = {},
}: CreatePaymentHandlersOptions = {}) {
  let paymentRows = [...initialRows]
  const categoryRows = [...initialCategoryRows]

  const getPaymentsHandler = http.get(REST_URL, async ({ request }) => {
    await delay(get.durationOrMode)

    if (get.error) {
      return HttpResponse.json({ message: "Failed to fetch payments." }, { status: 500 })
    }

    const rows = get.response ?? paymentRows
    const filteredRows = filterAndSortPayments(rows, request)

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
      paymentRows = [...paymentRows, create.response]
      return HttpResponse.json([create.response], { status: 201 })
    }

    const body = (await request.json()) as Record<string, unknown>
    const newRow = buildPaymentRow(body, paymentRows)
    paymentRows = [...paymentRows, newRow]

    return HttpResponse.json([newRow], { status: 201 })
  })

  const updatePaymentHandler = http.patch(REST_URL, async ({ request }) => {
    await delay(update.durationOrMode)

    if (update.error) {
      return HttpResponse.json({ message: "Failed to update payment." }, { status: 500 })
    }

    const id = extractPaymentId(request)
    const body = (await request.json()) as Partial<PaymentRow>

    paymentRows = paymentRows.map((row) => {
      if (String(row.id) !== id) {
        return row
      }

      return {
        ...row,
        ...body,
        updated_at: new Date().toISOString(),
      }
    })

    return HttpResponse.json(update.response ?? { message: "Updated" })
  })

  const deletePaymentHandler = http.delete(REST_URL, async ({ request }) => {
    await delay(deleteOptions.durationOrMode)

    if (deleteOptions.error) {
      return HttpResponse.json({ message: "Failed to delete payment." }, { status: 500 })
    }

    const id = extractPaymentId(request)
    paymentRows = paymentRows.filter((row) => String(row.id) !== id)

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

      const body = (await request.json()) as { p_month?: string }
      return HttpResponse.json(calculateMonthlyTotalAmount(paymentRows, body.p_month))
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
