import { type DelayMode, HttpResponse, delay, http } from "msw"
import * as z from "zod"

import { allCategories } from "../../data/categories"

const CATEGORIES_REST_URL = "*/rest/v1/categories*"
const CATEGORY_PINS_REST_URL = "*/rest/v1/category_pins*"
const CREATE_CATEGORY_WITH_PIN_RPC_URL = "*/rest/v1/rpc/create_category_with_pin_and_budget"
const UPDATE_CATEGORY_WITH_PIN_RPC_URL = "*/rest/v1/rpc/update_category_with_pin_and_budget"
const DELETE_CATEGORY_WITH_BUDGET_RPC_URL = "*/rest/v1/rpc/delete_category_with_budget"
const GET_EFFECTIVE_CATEGORY_BUDGETS_RPC_URL = "*/rest/v1/rpc/get_effective_category_budgets"
const CURRENT_BOOK_ID = 1

export interface CategorySettingsPinResponseRow {
  id: number
  category_id: number
}

export interface CategorySettingsResponseRow {
  id: number
  book_id: number
  name: string
  category_pins: CategorySettingsPinResponseRow[]
}

export interface CategoryBudgetResponseRow {
  category_id: number
  status: "amount" | "none"
  amount: number | null
}

interface GetCategorySettingsOptions {
  response?: CategorySettingsResponseRow[]
  budgetResponse?: CategoryBudgetResponseRow[]
  currentBookId?: number
  pinnedCategoryIds?: number[]
  error?: boolean
  durationOrMode?: number | DelayMode | undefined
}

interface UpdateCategorySettingsOptions {
  response?: { id: number } | null
  error?: boolean
  errorResponse?: unknown
  durationOrMode?: number | DelayMode | undefined
}

interface CreateCategorySettingsOptions {
  responseId?: number
  error?: boolean
  errorResponse?: unknown
  durationOrMode?: number | DelayMode | undefined
}

interface DeleteCategorySettingsOptions {
  response?: { id: number } | null
  error?: boolean
  errorResponse?: unknown
  durationOrMode?: number | DelayMode | undefined
}

interface CategoryPinSettingsOptions {
  responseId?: number
  error?: boolean
  errorResponse?: unknown
  durationOrMode?: number | DelayMode | undefined
}

const updateCategoryNameBodySchema = z.object({
  name: z.string(),
})

const createCategoryBodySchema = z.object({
  name: z.string(),
})

const createCategoryWithPinBodySchema = z.object({
  p_budget_amount: z.number().nullable(),
  p_category_name: z.string(),
  p_effective_month: z.string(),
  p_pinned: z.boolean(),
})

const updateCategoryWithPinBodySchema = z.object({
  p_budget_action: z.enum(["keep", "set", "unset"]),
  p_budget_amount: z.number().nullable(),
  p_category_id: z.number(),
  p_category_name: z.string(),
  p_effective_month: z.string(),
  p_pinned: z.boolean(),
})

const deleteCategoryWithBudgetBodySchema = z.object({
  p_category_id: z.number(),
})

const getEffectiveCategoryBudgetsBodySchema = z.object({
  p_target_month: z.string(),
})

const categoryPinBodySchema = z.object({
  category_id: z.number(),
})

export function createCategorySettingsHandlers({
  response,
  budgetResponse,
  currentBookId = CURRENT_BOOK_ID,
  pinnedCategoryIds = [10],
  error = false,
  durationOrMode,
  create = {},
  update = {},
  delete: deleteOptions = {},
  pin = {},
  unpin = {},
}: GetCategorySettingsOptions & {
  create?: CreateCategorySettingsOptions
  update?: UpdateCategorySettingsOptions
  delete?: DeleteCategorySettingsOptions
  pin?: CategoryPinSettingsOptions
  unpin?: CategoryPinSettingsOptions
} = {}) {
  let rows = response ?? buildCategorySettingsResponse(currentBookId, pinnedCategoryIds)
  let budgetRows = budgetResponse ?? buildCategoryBudgetResponse()

  return [
    http.get(CATEGORIES_REST_URL, async () => {
      await delay(durationOrMode)

      if (error) {
        return HttpResponse.json({ message: "Failed to fetch category settings." }, { status: 500 })
      }

      return HttpResponse.json(rows)
    }),
    http.post(CATEGORIES_REST_URL, async ({ request }) => {
      await delay(create.durationOrMode)

      if (create.error) {
        return HttpResponse.json(
          create.errorResponse ?? { message: "Failed to create category." },
          { status: 500 },
        )
      }

      const body = await request.json()
      createCategoryBodySchema.parse(body)

      return HttpResponse.json({ id: create.responseId ?? 999 })
    }),
    http.post(CREATE_CATEGORY_WITH_PIN_RPC_URL, async ({ request }) => {
      await delay(create.durationOrMode)

      if (create.error) {
        return HttpResponse.json(
          create.errorResponse ?? { message: "Failed to create category." },
          { status: 500 },
        )
      }

      const body = createCategoryWithPinBodySchema.parse(await request.json())
      const categoryId = create.responseId ?? 999
      if (body.p_budget_amount !== null) {
        budgetRows = [
          ...budgetRows.filter((row) => row.category_id !== categoryId),
          { category_id: categoryId, status: "amount", amount: body.p_budget_amount },
        ]
      }

      return HttpResponse.json(categoryId)
    }),
    http.patch(CATEGORIES_REST_URL, async ({ request }) => {
      await delay(update.durationOrMode)

      if (update.error) {
        return HttpResponse.json(update.errorResponse ?? { message: "Failed to save category." }, {
          status: 500,
        })
      }

      const body = await request.json()
      updateCategoryNameBodySchema.parse(body)
      const id = parseCategoryIdFilter(request.url)
      const updatedRow = buildUpdatedCategorySettingsRow(id)

      return HttpResponse.json("response" in update ? update.response : updatedRow)
    }),
    http.post(UPDATE_CATEGORY_WITH_PIN_RPC_URL, async ({ request }) => {
      await delay(update.durationOrMode)

      if (update.error) {
        return HttpResponse.json(update.errorResponse ?? { message: "Failed to save category." }, {
          status: 500,
        })
      }

      const body = updateCategoryWithPinBodySchema.parse(await request.json())

      rows = rows.map((row) =>
        row.id === body.p_category_id
          ? {
              ...row,
              name: body.p_category_name,
              category_pins: body.p_pinned
                ? [{ id: pin.responseId ?? row.id, category_id: row.id }]
                : [],
            }
          : row,
      )
      if (body.p_budget_action === "set") {
        budgetRows = [
          ...budgetRows.filter((row) => row.category_id !== body.p_category_id),
          { category_id: body.p_category_id, status: "amount", amount: body.p_budget_amount },
        ]
      }
      if (body.p_budget_action === "unset") {
        budgetRows = [
          ...budgetRows.filter((row) => row.category_id !== body.p_category_id),
          { category_id: body.p_category_id, status: "none", amount: null },
        ]
      }

      return HttpResponse.json("response" in update ? update.response : null)
    }),
    http.post(DELETE_CATEGORY_WITH_BUDGET_RPC_URL, async ({ request }) => {
      await delay(deleteOptions.durationOrMode)

      if (deleteOptions.error) {
        return HttpResponse.json(
          deleteOptions.errorResponse ?? { message: "Failed to delete category." },
          { status: 500 },
        )
      }

      const body = deleteCategoryWithBudgetBodySchema.parse(await request.json())
      rows = rows.filter((row) => row.id !== body.p_category_id)
      budgetRows = budgetRows.filter((row) => row.category_id !== body.p_category_id)

      return HttpResponse.json("response" in deleteOptions ? deleteOptions.response : null)
    }),
    http.post(GET_EFFECTIVE_CATEGORY_BUDGETS_RPC_URL, async ({ request }) => {
      await delay(durationOrMode)

      if (error) {
        return HttpResponse.json({ message: "Failed to fetch category budgets." }, { status: 500 })
      }

      getEffectiveCategoryBudgetsBodySchema.parse(await request.json())

      return HttpResponse.json(budgetRows)
    }),
    http.delete(CATEGORIES_REST_URL, async ({ request }) => {
      await delay(deleteOptions.durationOrMode)

      if (deleteOptions.error) {
        return HttpResponse.json(
          deleteOptions.errorResponse ?? { message: "Failed to delete category." },
          { status: 500 },
        )
      }

      const id = parseCategoryIdFilter(request.url)
      const deletedRow = rows.find((row) => row.id === id)

      if (deletedRow) {
        rows = rows.filter((row) => row.id !== id)
        budgetRows = budgetRows.filter((row) => row.category_id !== id)
      }

      return HttpResponse.json(
        "response" in deleteOptions ? deleteOptions.response : (deletedRow ?? null),
      )
    }),
    http.post(CATEGORY_PINS_REST_URL, async ({ request }) => {
      await delay(pin?.durationOrMode)

      if (pin?.error) {
        return HttpResponse.json(
          pin.errorResponse ?? { message: "Failed to update category pin." },
          { status: 500 },
        )
      }

      const body = categoryPinBodySchema.parse(await request.json())
      const categoryId = body.category_id

      rows = rows.map((row) =>
        row.id === categoryId
          ? {
              ...row,
              category_pins: [{ id: pin.responseId ?? categoryId, category_id: categoryId }],
            }
          : row,
      )

      return HttpResponse.json({ id: pin.responseId ?? categoryId })
    }),
    http.delete(CATEGORY_PINS_REST_URL, async ({ request }) => {
      await delay(unpin?.durationOrMode)

      if (unpin?.error) {
        return HttpResponse.json(
          unpin.errorResponse ?? { message: "Failed to update category pin." },
          { status: 500 },
        )
      }

      const categoryId = parseCategoryIdFilter(request.url, "category_id")

      if (categoryId !== undefined) {
        rows = rows.map((row) => (row.id === categoryId ? { ...row, category_pins: [] } : row))
      }

      return HttpResponse.json(categoryId === undefined ? [] : [{ id: categoryId }])
    }),
  ]
}

function buildCategoryBudgetResponse(): CategoryBudgetResponseRow[] {
  return [
    {
      category_id: 10,
      status: "amount",
      amount: 30000,
    },
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

function parseCategoryIdFilter(url: string, key = "id"): number | undefined {
  const idParam = new URL(url).searchParams.get(key)

  if (!idParam?.startsWith("eq.")) {
    return undefined
  }

  const id = Number(idParam.slice(3))

  return Number.isInteger(id) ? id : undefined
}

function buildUpdatedCategorySettingsRow(id: number | undefined): { id: number } | null {
  if (id === undefined) {
    return null
  }

  return { id }
}

export const categorySettingsHandlers = createCategorySettingsHandlers()
