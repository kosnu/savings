import { DelayMode, HttpResponse, delay, http } from "msw"

import { monthlyBudgets, type MonthlyBudgetRow } from "../../data/monthlyBudgets"

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

    const response = "response" in get ? get.response : monthlyBudgets[2]

    return HttpResponse.json(response)
  })

  return [getMonthlyBudgetHandler]
}

export const monthlyBudgetHandlers = createMonthlyBudgetHandlers()
