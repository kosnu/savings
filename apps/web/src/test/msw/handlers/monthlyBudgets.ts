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

type CreateMonthlyBudgetHandlersOptions =
  | {
      get?: GetMonthlyBudgetOptions
      list?: never
    }
  | {
      get?: never
      list: ListMonthlyBudgetOptions
    }

export function createMonthlyBudgetHandlers(options: CreateMonthlyBudgetHandlersOptions = {}) {
  if (options.get !== undefined && options.list !== undefined) {
    throw new Error("get and list monthly budget handler options cannot be used together")
  }

  const get = options.get ?? {}
  const list = options.list

  const getMonthlyBudgetHandler = http.get(REST_URL, async () => {
    const handlerOptions = list ?? get

    await delay(handlerOptions.durationOrMode)

    if (handlerOptions.error) {
      return HttpResponse.json({ message: "Failed to fetch monthly budgets." }, { status: 500 })
    }

    const response =
      list === undefined
        ? get.response === undefined
          ? monthlyBudgets[2]
          : get.response
        : list.response === undefined
          ? monthlyBudgets
          : list.response

    return HttpResponse.json(response)
  })

  return [getMonthlyBudgetHandler]
}

export const monthlyBudgetHandlers = createMonthlyBudgetHandlers()
