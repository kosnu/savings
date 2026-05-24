import { type DelayMode, HttpResponse, delay, http } from "msw"
import * as z from "zod"

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

interface UpdateCategorySettingsOptions {
  error?: boolean
  errorResponse?: unknown
  durationOrMode?: number | DelayMode | undefined
}

interface CreateCategorySettingsOptions {
  error?: boolean
  errorResponse?: unknown
  durationOrMode?: number | DelayMode | undefined
}

const updateCategoryNameBodySchema = z.object({
  name: z.string(),
})

const createCategoryWithBudgetBodySchema = z.object({
  p_category_name: z.string(),
  p_budget_effective_from: z.string().optional(),
  p_budget_amount: z.number().optional(),
})

type UpdateCategoryNameBody = z.infer<typeof updateCategoryNameBodySchema>
type CreateCategoryWithBudgetBody = z.infer<typeof createCategoryWithBudgetBodySchema>

export function createCategorySettingsHandlers({
  response,
  currentBookId = CURRENT_BOOK_ID,
  pinnedCategoryIds = [10],
  error = false,
  durationOrMode,
  create = {},
  update = {},
}: GetCategorySettingsOptions & {
  create?: CreateCategorySettingsOptions
  update?: UpdateCategorySettingsOptions
} = {}) {
  let rows = response ?? buildCategorySettingsResponse(currentBookId, pinnedCategoryIds)

  return [
    http.get(REST_URL, async () => {
      await delay(durationOrMode)

      if (error) {
        return HttpResponse.json({ message: "Failed to fetch category settings." }, { status: 500 })
      }

      return HttpResponse.json(rows)
    }),
    http.post("*/rest/v1/rpc/create_category_with_budget", async ({ request }) => {
      await delay(create.durationOrMode)

      if (create.error) {
        return HttpResponse.json(
          create.errorResponse ?? { message: "Failed to create category." },
          { status: 500 },
        )
      }

      const body = await request.json()
      const parsedBody = createCategoryWithBudgetBodySchema.parse(body)
      const createdRow = buildCreatedCategorySettingsRow(parsedBody, rows, currentBookId)

      rows = [...rows, createdRow]

      return HttpResponse.json(createdRow.id)
    }),
    http.patch(REST_URL, async ({ request }) => {
      await delay(update.durationOrMode)

      if (update.error) {
        return HttpResponse.json(
          update.errorResponse ?? { message: "Failed to update category name." },
          { status: 500 },
        )
      }

      const body = await request.json()
      const parsedBody = updateCategoryNameBodySchema.parse(body)
      const id = parseUpdateCategoryId(request.url)
      const updatedRow = buildUpdatedCategorySettingsRow(id, parsedBody, rows)

      if (updatedRow) {
        rows = rows.map((row) => (row.id === updatedRow.id ? updatedRow : row))
      }

      return HttpResponse.json(updatedRow ? { id: updatedRow.id } : null)
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

function buildCreatedCategorySettingsRow(
  body: CreateCategoryWithBudgetBody,
  rows: CategorySettingsResponseRow[],
  currentBookId: number,
): CategorySettingsResponseRow {
  const id = Math.max(0, ...rows.map((row) => row.id)) + 1
  const amount = body.p_budget_amount
  const effectiveFrom = body.p_budget_effective_from

  return {
    id,
    book_id: currentBookId,
    name: body.p_category_name,
    category_budgets:
      amount !== undefined && effectiveFrom
        ? [
            {
              id: Math.max(0, ...rows.flatMap((row) => row.category_budgets.map((b) => b.id))) + 1,
              amount,
              effective_from: effectiveFrom,
              effective_year: Number.parseInt(effectiveFrom.slice(0, 4), 10),
              effective_month: Number.parseInt(effectiveFrom.slice(5, 7), 10),
            },
          ]
        : [],
    category_pins: [],
  }
}

function parseUpdateCategoryId(url: string): number | undefined {
  const idParam = new URL(url).searchParams.get("id")

  if (!idParam?.startsWith("eq.")) {
    return undefined
  }

  const id = Number(idParam.slice(3))

  return Number.isInteger(id) ? id : undefined
}

function buildUpdatedCategorySettingsRow(
  id: number | undefined,
  body: UpdateCategoryNameBody,
  rows: CategorySettingsResponseRow[],
): CategorySettingsResponseRow | undefined {
  const row = rows.find((category) => category.id === id)

  if (!row) {
    return undefined
  }

  return {
    ...row,
    name: body.name,
  }
}

export const categorySettingsHandlers = createCategorySettingsHandlers()
