import { DelayMode, HttpResponse, delay, http } from "msw"

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

interface CreateMonthlyBudgetHandlersOptions {
  get?: GetMonthlyBudgetOptions
}

export function createMonthlyBudgetHandlers({ get = {} }: CreateMonthlyBudgetHandlersOptions = {}) {
  const getMonthlyBudgetHandler = http.get(REST_URL, async () => {
    await delay(get.durationOrMode)

    if (get.error) {
      return HttpResponse.json({ message: "Failed to fetch monthly budgets." }, { status: 500 })
    }

    const response = get.response === undefined ? monthlyBudgets[2] : get.response

    return HttpResponse.json(response)
  })

  return [getMonthlyBudgetHandler]
}

export const monthlyBudgetHandlers = createMonthlyBudgetHandlers()
