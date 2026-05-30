import { type DelayMode, HttpResponse, delay, http } from "msw"
import * as z from "zod"

import { allCategories } from "../../data/categories"

const REST_URL = "*/rest/v1/categories*"
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

interface GetCategorySettingsOptions {
  response?: CategorySettingsResponseRow[]
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

const updateCategoryNameBodySchema = z.object({
  name: z.string(),
})

const createCategoryBodySchema = z.object({
  name: z.string(),
})

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
  const rows = response ?? buildCategorySettingsResponse(currentBookId, pinnedCategoryIds)

  return [
    http.get(REST_URL, async () => {
      await delay(durationOrMode)

      if (error) {
        return HttpResponse.json({ message: "Failed to fetch category settings." }, { status: 500 })
      }

      return HttpResponse.json(rows)
    }),
    http.post(REST_URL, async ({ request }) => {
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
    http.patch(REST_URL, async ({ request }) => {
      await delay(update.durationOrMode)

      if (update.error) {
        return HttpResponse.json(
          update.errorResponse ?? { message: "Failed to update category name." },
          { status: 500 },
        )
      }

      const body = await request.json()
      updateCategoryNameBodySchema.parse(body)
      const id = parseUpdateCategoryId(request.url)
      const updatedRow = buildUpdatedCategorySettingsRow(id)

      return HttpResponse.json("response" in update ? update.response : updatedRow)
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

function parseUpdateCategoryId(url: string): number | undefined {
  const idParam = new URL(url).searchParams.get("id")

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
