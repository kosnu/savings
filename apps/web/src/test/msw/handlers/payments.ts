import { DelayMode, HttpResponse, delay, http } from "msw"

import type { PaymentRow } from "../../../types/payment"
import { payments } from "../../data/payments"
import { mapPaymentToRow } from "../../utils/mapPaymentToRow"

const REST_URL = "*/rest/v1/payments*"
const MONTHLY_TOTAL_AMOUNT_REST_URL = "*/rest/v1/rpc/get_monthly_total_amount"

const initialPaymentRows: PaymentRow[] = payments.map(mapPaymentToRow)

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

interface GetMonthlyTotalAmountOptions extends BaseOptions {
  response?: number
}

interface CreatePaymentHandlersOptions {
  initialRows?: PaymentRow[]
  get?: GetPaymentsOptions
  create?: CreatePaymentOptions
  delete?: DeletePaymentOptions
  getMonthlyTotalAmount?: GetMonthlyTotalAmountOptions
}

function filterAndSortPayments(rows: PaymentRow[], request: Request): PaymentRow[] {
  const url = new URL(request.url)
  const dateFilters = url.searchParams.getAll("date")

  const from = dateFilters.find((value) => value.startsWith("gte."))?.replace("gte.", "")
  const to = dateFilters.find((value) => value.startsWith("lte."))?.replace("lte.", "")

  return rows
    .filter((row) => {
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
  delete: deleteOptions = {},
  getMonthlyTotalAmount = {},
}: CreatePaymentHandlersOptions = {}) {
  let paymentRows = [...initialRows]

  const getPaymentsHandler = http.get(REST_URL, async ({ request }) => {
    await delay(get.durationOrMode)

    if (get.error) {
      return HttpResponse.json({ message: "Failed to fetch payments." }, { status: 500 })
    }

    const rows = get.response ?? paymentRows
    return HttpResponse.json(filterAndSortPayments(rows, request))
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
    deletePaymentHandler,
    getMonthlyTotalAmountHandler,
  ]
}

export const paymentHandlers = createPaymentHandlers()
