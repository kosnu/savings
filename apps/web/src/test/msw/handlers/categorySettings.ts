import { type DelayMode, HttpResponse, delay, http } from "msw"

import { allCategories } from "../../data/categories"
import { categoryBudgets } from "../../data/categoryBudgets"

const REST_URL = "*/rest/v1/categories*"
const CURRENT_BOOK_ID = 1

export interface CategorySettingsBudgetResponseRow {
  id: number
  amount: number
  effective_from: string
  effective_year: number
  effective_month: number
}

export interface CategorySettingsPinResponseRow {
  id: number
  category_id: number
}

export interface CategorySettingsResponseRow {
  id: number
  book_id: number
  name: string
  category_budgets: CategorySettingsBudgetResponseRow[]
  category_pins: CategorySettingsPinResponseRow[]
}

interface GetCategorySettingsOptions {
  response?: CategorySettingsResponseRow[]
  currentBookId?: number
  pinnedCategoryIds?: number[]
  error?: boolean
  durationOrMode?: number | DelayMode | undefined
}

export function createCategorySettingsHandlers({
  response,
  currentBookId = CURRENT_BOOK_ID,
  pinnedCategoryIds = [10],
  error = false,
  durationOrMode,
}: GetCategorySettingsOptions = {}) {
  return [
    http.get(REST_URL, async () => {
      await delay(durationOrMode)

      if (error) {
        return HttpResponse.json({ message: "Failed to fetch category settings." }, { status: 500 })
      }

      return HttpResponse.json(
        response ?? buildCategorySettingsResponse(currentBookId, pinnedCategoryIds),
      )
    }),
  ]
}

function buildCategorySettingsResponse(
  currentBookId: number,
  pinnedCategoryIds: number[],
): CategorySettingsResponseRow[] {
  return allCategories
    .filter((category) => category.bookId === currentBookId)
    .map((category) => ({
      id: category.id,
      book_id: category.bookId,
      name: category.name,
      category_budgets: categoryBudgets
        .filter((budget) => budget.book_id === currentBookId && budget.category_id === category.id)
        .sort((a, b) => {
          if (a.effective_from !== b.effective_from) {
            return b.effective_from.localeCompare(a.effective_from)
          }

          return b.id - a.id
        })
        .slice(0, 1)
        .map((budget) => ({
          id: budget.id,
          amount: budget.amount,
          effective_from: budget.effective_from,
          effective_year: budget.effective_year,
          effective_month: budget.effective_month,
        })),
      category_pins: pinnedCategoryIds.includes(category.id)
        ? [
            {
              id: category.id,
              category_id: category.id,
            },
          ]
        : [],
    }))
}

export const categorySettingsHandlers = createCategorySettingsHandlers()
