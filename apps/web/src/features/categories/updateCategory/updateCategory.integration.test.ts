import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { createCategorySettingsHandlers } from "../../../test/msw/handlers/categorySettings"
import { server } from "../../../test/msw/server"
import { supabaseTestClient } from "../../../test/utils/createSupabaseTestClient"
import { fetchCategorySettingsItems } from "../listCategorySettings/fetchCategorySettingsItems"
import { updateCategory } from "./updateCategory"

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => supabaseTestClient,
}))

const foodCategory = {
  id: 10,
  book_id: 1,
  name: "Food",
  category_budgets: [
    {
      id: 30,
      amount: 50000,
      effective_from: "2026-05-01",
      effective_year: 2026,
      effective_month: 5,
    },
  ],
  category_pins: [],
}

const dailyNecessitiesCategory = {
  id: 20,
  book_id: 1,
  name: "Daily Necessities",
  category_budgets: [
    {
      id: 40,
      amount: 30000,
      effective_from: "2026-05-01",
      effective_year: 2026,
      effective_month: 5,
    },
  ],
  category_pins: [],
}

describe("updateCategory", () => {
  beforeEach(() => {
    server.resetHandlers(
      ...createCategorySettingsHandlers({
        response: [foodCategory, dailyNecessitiesCategory],
      }),
    )
  })

  it("RPCでカテゴリ名とカテゴリ別予算額を更新し、カテゴリ設定一覧に反映する", async () => {
    await updateCategory({
      categoryId: 10,
      name: "Groceries",
      categoryBudgetId: 30,
      budgetAmount: 55000,
    })

    const items = await fetchCategorySettingsItems()

    expect(items[0]).toMatchObject({
      category: {
        id: 10,
        name: "Groceries",
      },
      latestCategoryBudget: {
        id: 30,
        amount: 55000,
        effectiveYear: 2026,
        effectiveMonth: 5,
      },
    })
    expect(items[0]?.latestCategoryBudget?.effectiveFrom).toEqual(new Date(2026, 4, 1))
    expect(items[1]).toMatchObject({
      category: {
        id: 20,
        name: "Daily Necessities",
      },
      latestCategoryBudget: {
        id: 40,
        amount: 30000,
      },
    })
  })

  it("カテゴリとカテゴリ別予算が一致しない場合は状態を変えずにrejectする", async () => {
    await expect(
      updateCategory({
        categoryId: 10,
        name: "Groceries",
        categoryBudgetId: 40,
        budgetAmount: 55000,
      }),
    ).rejects.toMatchObject({
      message: "Category budget was not updated.",
    })

    const items = await fetchCategorySettingsItems()

    expect(items[0]).toMatchObject({
      category: {
        id: 10,
        name: "Food",
      },
      latestCategoryBudget: {
        id: 30,
        amount: 50000,
      },
    })
    expect(items[1]).toMatchObject({
      category: {
        id: 20,
        name: "Daily Necessities",
      },
      latestCategoryBudget: {
        id: 40,
        amount: 30000,
      },
    })
  })
})
