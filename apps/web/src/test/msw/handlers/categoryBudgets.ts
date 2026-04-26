import { type DelayMode, HttpResponse, delay, http } from "msw"

import type { CategoryBudgetRow } from "../../../features/budgets/types"
import { categories } from "../../data/categories"
import { categoryBudgets } from "../../data/categoryBudgets"

const REST_URL = "*/rest/v1/category_budgets*"

interface CategoryBudgetResponseRow extends CategoryBudgetRow {
  category: {
    id: number
    name: string
  }
}

interface GetCategoryBudgetsOptions {
  response?: CategoryBudgetResponseRow[]
  error?: boolean
  durationOrMode?: number | DelayMode | undefined
}

interface CreateCategoryBudgetHandlersOptions {
  get?: GetCategoryBudgetsOptions
}

const defaultCategoryBudgetRows: CategoryBudgetResponseRow[] = categoryBudgets.map((row) => {
  const category = categories.find((candidate) => candidate.id === row.category_id)

  return {
    ...row,
    category: {
      id: row.category_id,
      name: category?.name ?? "Unknown",
    },
  }
})

export function createCategoryBudgetHandlers({
  get = {},
}: CreateCategoryBudgetHandlersOptions = {}) {
  const categoryBudgetsHandler = http.get(REST_URL, async () => {
    await delay(get.durationOrMode)

    if (get.error) {
      return HttpResponse.json({ message: "Failed to fetch category budgets." }, { status: 500 })
    }

    return HttpResponse.json(get.response ?? defaultCategoryBudgetRows)
  })

  return [categoryBudgetsHandler]
}

export const categoryBudgetHandlers = createCategoryBudgetHandlers()
