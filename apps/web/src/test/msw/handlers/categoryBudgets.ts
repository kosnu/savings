import { type DelayMode, HttpResponse, delay, http } from "msw"
import * as z from "zod"

import type { CategoryBudgetRow } from "../../../features/budgets/types"
import { allCategories } from "../../data/categories"
import { categoryBudgets } from "../../data/categoryBudgets"

const REST_URL = "*/rest/v1/category_budgets*"
const CURRENT_BOOK_ID = 1

interface CategoryBudgetResponseRow extends CategoryBudgetRow {
  category: {
    id: number
    name: string
  }
}

interface BaseOptions {
  error?: boolean
  durationOrMode?: number | DelayMode | undefined
}

interface GetCategoryBudgetsOptions extends BaseOptions {
  rows?: CategoryBudgetRow[]
  response?: CategoryBudgetResponseRow[]
}

interface CreateCategoryBudgetOptions extends BaseOptions {
  response?: CategoryBudgetResponseRow
  errorResponse?: unknown
}

interface CreateCategoryBudgetHandlersOptions {
  currentBookId?: number
  get?: GetCategoryBudgetsOptions
  create?: CreateCategoryBudgetOptions
}

const createCategoryBudgetBodySchema = z.object({
  amount: z.number(),
  category_id: z.number(),
  effective_from: z.string(),
})

type CreateCategoryBudgetBody = z.infer<typeof createCategoryBudgetBodySchema>

function toCategoryBudgetResponseRows(
  rows: CategoryBudgetRow[],
  currentBookId: number,
): CategoryBudgetResponseRow[] {
  return rows.map((row) => toCategoryBudgetResponseRow(row, currentBookId))
}

function toCategoryBudgetResponseRow(
  row: CategoryBudgetRow,
  currentBookId: number,
): CategoryBudgetResponseRow {
  const category = allCategories.find(
    (candidate) => candidate.id === row.category_id && candidate.bookId === currentBookId,
  )

  return {
    ...row,
    category: {
      id: row.category_id,
      name: category?.name ?? "Unknown",
    },
  }
}

export function createCategoryBudgetHandlers({
  currentBookId = CURRENT_BOOK_ID,
  get = {},
  create = {},
}: CreateCategoryBudgetHandlersOptions = {}) {
  const getRows =
    get.response ?? toCategoryBudgetResponseRows(get.rows ?? categoryBudgets, currentBookId)

  const categoryBudgetsHandler = http.get(REST_URL, async () => {
    await delay(get.durationOrMode)

    if (get.error) {
      return HttpResponse.json({ message: "Failed to fetch category budgets." }, { status: 500 })
    }

    return HttpResponse.json(getRows)
  })

  const createCategoryBudgetHandler = http.post(REST_URL, async ({ request }) => {
    await delay(create.durationOrMode)

    if (create.error) {
      return HttpResponse.json(
        create.errorResponse ?? { message: "Failed to create category budget." },
        { status: 500 },
      )
    }

    if (create.response) {
      return HttpResponse.json([create.response], { status: 201 })
    }

    const body = await request.json()
    const parsedBody = createCategoryBudgetBodySchema.parse(body)
    const newRow = buildCategoryBudgetRow(parsedBody, getRows, currentBookId)

    return HttpResponse.json([newRow], { status: 201 })
  })

  return [categoryBudgetsHandler, createCategoryBudgetHandler]
}

function buildCategoryBudgetRow(
  body: CreateCategoryBudgetBody,
  rows: CategoryBudgetResponseRow[],
  currentBookId: number,
): CategoryBudgetResponseRow {
  const [year, month] = body.effective_from.split("-").map((value) => Number.parseInt(value, 10))
  const now = new Date().toISOString()
  const category = allCategories.find(
    (candidate) => candidate.id === body.category_id && candidate.bookId === currentBookId,
  )

  return {
    id: Math.max(0, ...rows.map((row) => row.id)) + 1,
    book_id: currentBookId,
    amount: body.amount,
    category_id: body.category_id,
    created_at: now,
    effective_from: body.effective_from,
    effective_month: month,
    effective_year: year,
    updated_at: now,
    category: {
      id: body.category_id,
      name: category?.name ?? "Unknown",
    },
  }
}

export const categoryBudgetHandlers = createCategoryBudgetHandlers()
