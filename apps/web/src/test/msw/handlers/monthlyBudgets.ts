import { type DelayMode, HttpResponse, delay, http } from "msw"
import * as z from "zod"

import type { MonthlyBudgetRow } from "../../../features/budgets/types"
import { monthlyBudgets } from "../../data/monthlyBudgets"

const REST_URL = "*/rest/v1/monthly_budgets*"

interface BaseOptions {
  error?: boolean
  durationOrMode?: number | DelayMode | undefined
}

interface GetMonthlyBudgetOptions extends BaseOptions {
  response?: MonthlyBudgetRow | null
}

interface ListMonthlyBudgetOptions extends BaseOptions {
  response?: MonthlyBudgetRow[]
}

interface CreateMonthlyBudgetOptions extends BaseOptions {
  response?: MonthlyBudgetRow
}

interface CreateMonthlyBudgetHandlersOptions {
  get?: GetMonthlyBudgetOptions
  list?: ListMonthlyBudgetOptions
  create?: CreateMonthlyBudgetOptions
}

const createMonthlyBudgetBodySchema = z.object({
  amount: z.number(),
  effective_from: z.string(),
})

type CreateMonthlyBudgetBody = z.infer<typeof createMonthlyBudgetBodySchema>

export function createMonthlyBudgetHandlers(options: CreateMonthlyBudgetHandlersOptions = {}) {
  const get = options.get ?? {}
  const list = options.list ?? {}
  const create = options.create ?? {}
  let monthlyBudgetRows = [...(list.response ?? monthlyBudgets)]

  const monthlyBudgetsHandler = http.get(REST_URL, async ({ request }) => {
    const shouldReturnSingle = shouldReturnSingleObject(request)
    const handlerOptions = shouldReturnSingle ? get : list

    await delay(handlerOptions.durationOrMode)

    if (handlerOptions.error) {
      return HttpResponse.json({ message: "Failed to fetch monthly budgets." }, { status: 500 })
    }

    const response = shouldReturnSingle
      ? get.response === undefined
        ? monthlyBudgets[2]
        : get.response
      : monthlyBudgetRows

    return HttpResponse.json(response)
  })

  const createMonthlyBudgetHandler = http.post(REST_URL, async ({ request }) => {
    await delay(create.durationOrMode)

    if (create.error) {
      return HttpResponse.json({ message: "Failed to create monthly budget." }, { status: 500 })
    }

    if (create.response) {
      monthlyBudgetRows = [...monthlyBudgetRows, create.response]
      return HttpResponse.json([create.response], { status: 201 })
    }

    const body = await request.json()
    const parsedBody = createMonthlyBudgetBodySchema.parse(body)
    const newRow = buildMonthlyBudgetRow(parsedBody, monthlyBudgetRows)
    monthlyBudgetRows = [...monthlyBudgetRows, newRow]

    return HttpResponse.json([newRow], { status: 201 })
  })

  return [monthlyBudgetsHandler, createMonthlyBudgetHandler]
}

function shouldReturnSingleObject(request: Request): boolean {
  const url = new URL(request.url)

  return url.searchParams.has("effective_from") && url.searchParams.get("limit") === "1"
}

function buildMonthlyBudgetRow(
  body: CreateMonthlyBudgetBody,
  rows: MonthlyBudgetRow[],
): MonthlyBudgetRow {
  const [year, month] = body.effective_from.split("-").map((value) => Number.parseInt(value, 10))
  const now = new Date().toISOString()

  return {
    id: Math.max(0, ...rows.map((row) => row.id)) + 1,
    amount: body.amount,
    created_at: now,
    effective_from: body.effective_from,
    effective_month: month,
    effective_year: year,
    updated_at: now,
    user_id: 100,
  }
}

export const monthlyBudgetHandlers = createMonthlyBudgetHandlers()
