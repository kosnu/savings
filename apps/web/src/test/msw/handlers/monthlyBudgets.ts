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
  errorResponse?: unknown
}

interface UpdateMonthlyBudgetOptions extends BaseOptions {
  response?: MonthlyBudgetRow
  errorResponse?: unknown
}

interface CreateMonthlyBudgetHandlersOptions {
  get?: GetMonthlyBudgetOptions
  list?: ListMonthlyBudgetOptions
  create?: CreateMonthlyBudgetOptions
  update?: UpdateMonthlyBudgetOptions
}

const createMonthlyBudgetBodySchema = z.object({
  amount: z.number(),
  effective_from: z.string(),
})

const updateMonthlyBudgetBodySchema = z.object({
  amount: z.number(),
})

type CreateMonthlyBudgetBody = z.infer<typeof createMonthlyBudgetBodySchema>
type UpdateMonthlyBudgetBody = z.infer<typeof updateMonthlyBudgetBodySchema>

export function createMonthlyBudgetHandlers(options: CreateMonthlyBudgetHandlersOptions = {}) {
  const get = options.get ?? {}
  const list = options.list ?? {}
  const create = options.create ?? {}
  const update = options.update ?? {}
  let listRows = list.response ? [...list.response] : [...monthlyBudgets]

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
      : listRows

    return HttpResponse.json(response)
  })

  const createMonthlyBudgetHandler = http.post(REST_URL, async ({ request }) => {
    await delay(create.durationOrMode)

    if (create.error) {
      return HttpResponse.json(
        create.errorResponse ?? { message: "Failed to create monthly budget." },
        { status: 500 },
      )
    }

    if (create.response) {
      return HttpResponse.json([create.response], { status: 201 })
    }

    const body = await request.json()
    const parsedBody = createMonthlyBudgetBodySchema.parse(body)
    const newRow = buildMonthlyBudgetRow(parsedBody, list.response ?? monthlyBudgets)

    return HttpResponse.json([newRow], { status: 201 })
  })

  const updateMonthlyBudgetHandler = http.patch(REST_URL, async ({ request }) => {
    await delay(update.durationOrMode)

    if (update.error) {
      return HttpResponse.json(
        update.errorResponse ?? { message: "Failed to update monthly budget." },
        { status: 500 },
      )
    }

    const body = await request.json()
    const parsedBody = updateMonthlyBudgetBodySchema.parse(body)
    const id = parseUpdateMonthlyBudgetId(request.url)
    const updatedRow = update.response ?? buildUpdatedMonthlyBudgetRow(id, parsedBody, listRows)

    if (updatedRow) {
      listRows = listRows.map((row) => (row.id === updatedRow.id ? updatedRow : row))
    }

    return HttpResponse.json(updatedRow ? { id: updatedRow.id } : null)
  })

  return [monthlyBudgetsHandler, createMonthlyBudgetHandler, updateMonthlyBudgetHandler]
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
    book_id: 1,
    amount: body.amount,
    created_at: now,
    effective_from: body.effective_from,
    effective_month: month,
    effective_year: year,
    updated_at: now,
  }
}

function parseUpdateMonthlyBudgetId(url: string): number | undefined {
  const searchParams = new URL(url).searchParams
  const idParam = searchParams.get("id")

  if (!idParam?.startsWith("eq.")) {
    return undefined
  }

  const id = Number(idParam.slice(3))

  return Number.isInteger(id) ? id : undefined
}

function buildUpdatedMonthlyBudgetRow(
  id: number | undefined,
  body: UpdateMonthlyBudgetBody,
  rows: MonthlyBudgetRow[],
): MonthlyBudgetRow | undefined {
  const row = rows.find((monthlyBudget) => monthlyBudget.id === id)

  if (!row) {
    return undefined
  }

  return {
    ...row,
    amount: body.amount,
    updated_at: new Date().toISOString(),
  }
}

export const monthlyBudgetHandlers = createMonthlyBudgetHandlers()
