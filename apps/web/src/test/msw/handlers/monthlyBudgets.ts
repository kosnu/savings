import { type DelayMode, HttpResponse, delay, http } from "msw"

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

interface CreateMonthlyBudgetHandlersOptions {
  get?: GetMonthlyBudgetOptions
  list?: ListMonthlyBudgetOptions
}

export function createMonthlyBudgetHandlers(options: CreateMonthlyBudgetHandlersOptions = {}) {
  const get = options.get ?? {}
  const list = options.list ?? {}

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
      : list.response === undefined
        ? monthlyBudgets
        : list.response

    return HttpResponse.json(response)
  })

  return [monthlyBudgetsHandler]
}

function shouldReturnSingleObject(request: Request): boolean {
  const url = new URL(request.url)

  return url.searchParams.has("effective_from") && url.searchParams.get("limit") === "1"
}

export const monthlyBudgetHandlers = createMonthlyBudgetHandlers()
