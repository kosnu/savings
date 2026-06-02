import { type DelayMode, HttpResponse, delay, http } from "msw"
import * as z from "zod"

import type { MonthlyBudgetRow } from "../../../features/budgets/types"
import { monthlyBudgets } from "../../data/monthlyBudgets"

const REST_URL = "*/rest/v1/monthly_budgets*"
const GET_EFFECTIVE_RPC_URL = "*/rest/v1/rpc/get_effective_monthly_budget"
const CREATE_RPC_URL = "*/rest/v1/rpc/create_monthly_budget"
const UPDATE_RPC_URL = "*/rest/v1/rpc/update_current_monthly_budget"
const REMOVE_RPC_URL = "*/rest/v1/rpc/remove_current_monthly_budget"

interface BaseOptions {
  error?: boolean
  durationOrMode?: number | DelayMode | undefined
}

interface GetMonthlyBudgetOptions extends BaseOptions {
  response?: MonthlyBudgetRow | MonthlyBudgetStateResponse | null
}

interface ListMonthlyBudgetOptions extends BaseOptions {
  response?: MonthlyBudgetRow[]
}

interface CreateMonthlyBudgetOptions extends BaseOptions {
  errorResponse?: unknown
}

interface UpdateMonthlyBudgetOptions extends BaseOptions {
  response?: MonthlyBudgetRow
  errorResponse?: unknown
}

interface RemoveMonthlyBudgetOptions extends BaseOptions {
  errorResponse?: unknown
}

interface CreateMonthlyBudgetHandlersOptions {
  get?: GetMonthlyBudgetOptions
  list?: ListMonthlyBudgetOptions
  create?: CreateMonthlyBudgetOptions
  update?: UpdateMonthlyBudgetOptions
  remove?: RemoveMonthlyBudgetOptions
}

const createMonthlyBudgetBodySchema = z.object({
  p_amount: z.number(),
  p_effective_month: z.string(),
})

const updateMonthlyBudgetBodySchema = z.object({
  p_amount: z.number(),
})

type UpdateMonthlyBudgetBody = z.infer<typeof updateMonthlyBudgetBodySchema>
type MonthlyBudgetStateResponse =
  | { status: "amount"; monthly_budget: MonthlyBudgetRow }
  | { status: "none"; monthly_budget: null }
  | { status: "unset"; monthly_budget: null }

export function createMonthlyBudgetHandlers(options: CreateMonthlyBudgetHandlersOptions = {}) {
  const get = options.get ?? {}
  const list = options.list ?? {}
  const create = options.create ?? {}
  const update = options.update ?? {}
  const remove = options.remove ?? {}
  const listRows = list.response ?? monthlyBudgets

  const monthlyBudgetsHandler = http.get(REST_URL, async () => {
    await delay(list.durationOrMode)

    if (list.error) {
      return HttpResponse.json({ message: "Failed to fetch monthly budgets." }, { status: 500 })
    }

    const response = listRows.filter((monthlyBudget) => monthlyBudget.status === "amount")

    return HttpResponse.json(response)
  })

  const getEffectiveMonthlyBudgetHandler = http.post(GET_EFFECTIVE_RPC_URL, async () => {
    await delay(get.durationOrMode)

    if (get.error) {
      return HttpResponse.json({ message: "Failed to fetch monthly budgets." }, { status: 500 })
    }

    const response = get.response === undefined ? monthlyBudgets[2] : get.response

    return HttpResponse.json(toMonthlyBudgetStateResponse(response))
  })

  const createMonthlyBudgetHandler = http.post(CREATE_RPC_URL, async ({ request }) => {
    await delay(create.durationOrMode)

    if (create.error) {
      return HttpResponse.json(
        create.errorResponse ?? { message: "Failed to create monthly budget." },
        { status: 500 },
      )
    }

    const body = await request.json()
    createMonthlyBudgetBodySchema.parse(body)

    return HttpResponse.json(null, { status: 201 })
  })

  const updateMonthlyBudgetHandler = http.post(UPDATE_RPC_URL, async ({ request }) => {
    await delay(update.durationOrMode)

    if (update.error) {
      return HttpResponse.json(
        update.errorResponse ?? { message: "Failed to update monthly budget." },
        { status: 500 },
      )
    }

    const body = await request.json()
    const parsedBody = updateMonthlyBudgetBodySchema.parse(body)
    const updatedRow = update.response ?? buildUpdatedMonthlyBudgetRow(parsedBody, listRows)

    if (!updatedRow) {
      return HttpResponse.json({ message: "Monthly budget was not updated." }, { status: 500 })
    }

    return HttpResponse.json(null)
  })

  const removeMonthlyBudgetHandler = http.post(REMOVE_RPC_URL, async () => {
    await delay(remove.durationOrMode)

    if (remove.error) {
      return HttpResponse.json(
        remove.errorResponse ?? { message: "Failed to remove monthly budget." },
        { status: 500 },
      )
    }

    return HttpResponse.json(null)
  })

  return [
    monthlyBudgetsHandler,
    getEffectiveMonthlyBudgetHandler,
    createMonthlyBudgetHandler,
    updateMonthlyBudgetHandler,
    removeMonthlyBudgetHandler,
  ]
}

function buildUpdatedMonthlyBudgetRow(
  body: UpdateMonthlyBudgetBody,
  rows: MonthlyBudgetRow[],
): MonthlyBudgetRow | undefined {
  const row = rows.find((monthlyBudget) => monthlyBudget.status === "amount")

  if (!row) {
    return undefined
  }

  return {
    ...row,
    amount: body.p_amount,
    updated_at: new Date().toISOString(),
  }
}

function toMonthlyBudgetStateResponse(
  value: MonthlyBudgetRow | MonthlyBudgetStateResponse | null,
): MonthlyBudgetStateResponse {
  if (value === null) {
    return { status: "unset", monthly_budget: null }
  }

  if ("monthly_budget" in value) {
    return value
  }

  if (value.status === "none") {
    return { status: "none", monthly_budget: null }
  }

  return { status: "amount", monthly_budget: value }
}

export const monthlyBudgetHandlers = createMonthlyBudgetHandlers()
