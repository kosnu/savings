import { HttpResponse, http } from "msw"
import { beforeEach, describe, expect, it, vi } from "vite-plus/test"

import { createCategoryBudgetHandlers } from "../../../test/msw/handlers/categoryBudgets"
import { server } from "../../../test/msw/server"
import { supabaseTestClient } from "../../../test/utils/createSupabaseTestClient"
import { fetchCategoryBudgets } from "./fetchCategoryBudgets"

vi.mock("../../../lib/supabase", () => ({
  getSupabaseClient: () => supabaseTestClient,
}))

const foodBudgetOld = {
  id: 1,
  amount: 30000,
  category_id: 10,
  created_at: "2025-01-01T00:00:00.000Z",
  effective_from: "2025-01-01",
  effective_month: 1,
  effective_year: 2025,
  updated_at: "2025-01-01T00:00:00.000Z",
  user_id: 100,
  category: {
    id: 10,
    name: "Food",
  },
}

const foodBudgetLatestSameDay = {
  id: 3,
  amount: 50000,
  category_id: 10,
  created_at: "2025-03-02T00:00:00.000Z",
  effective_from: "2025-03-01",
  effective_month: 3,
  effective_year: 2025,
  updated_at: "2025-03-02T00:00:00.000Z",
  user_id: 100,
  category: {
    id: 10,
    name: "Food",
  },
}

const foodBudgetOlderSameDay = {
  id: 2,
  amount: 45000,
  category_id: 10,
  created_at: "2025-03-01T00:00:00.000Z",
  effective_from: "2025-03-01",
  effective_month: 3,
  effective_year: 2025,
  updated_at: "2025-03-01T00:00:00.000Z",
  user_id: 100,
  category: {
    id: 10,
    name: "Food",
  },
}

const dailyNecessitiesFutureBudget = {
  id: 4,
  amount: 12000,
  category_id: 20,
  created_at: "2099-04-01T00:00:00.000Z",
  effective_from: "2099-04-01",
  effective_month: 4,
  effective_year: 2099,
  updated_at: "2099-04-01T00:00:00.000Z",
  user_id: 100,
  category: {
    id: 20,
    name: "Daily Necessities",
  },
}

describe("fetchCategoryBudgets", () => {
  beforeEach(() => {
    server.resetHandlers(...createCategoryBudgetHandlers())
  })

  it("カテゴリ別予算一覧を取得してカテゴリ名つきの domain model に変換する", async () => {
    server.resetHandlers(
      ...createCategoryBudgetHandlers({
        get: {
          response: [foodBudgetLatestSameDay, dailyNecessitiesFutureBudget],
        },
      }),
    )

    const budgets = await fetchCategoryBudgets()

    expect(budgets).toHaveLength(2)
    expect(budgets[0]).toMatchObject({
      id: 3,
      amount: 50000,
      categoryId: 10,
      categoryName: "Food",
      effectiveYear: 2025,
      effectiveMonth: 3,
      userId: 100,
    })
    expect(budgets[0]?.effectiveFrom).toEqual(new Date(2025, 2, 1))
    expect(budgets[0]?.createdDate).toBeInstanceOf(Date)
    expect(budgets[0]?.updatedDate).toBeInstanceOf(Date)
  })

  it("登録済みカテゴリ別予算がない場合は空配列を返す", async () => {
    server.resetHandlers(
      ...createCategoryBudgetHandlers({
        get: {
          response: [],
        },
      }),
    )

    await expect(fetchCategoryBudgets()).resolves.toEqual([])
  })

  it("未来日付のカテゴリ別予算も取得対象に含める", async () => {
    server.resetHandlers(
      ...createCategoryBudgetHandlers({
        get: {
          response: [dailyNecessitiesFutureBudget],
        },
      }),
    )

    const budgets = await fetchCategoryBudgets()

    expect(budgets).toHaveLength(1)
    expect(budgets[0]).toMatchObject({
      id: 4,
      categoryId: 20,
      effectiveYear: 2099,
      effectiveMonth: 4,
    })
  })

  it("同じカテゴリに複数予算がある場合は最新の1件だけを返す", async () => {
    server.resetHandlers(
      ...createCategoryBudgetHandlers({
        get: {
          response: [
            foodBudgetOld,
            foodBudgetOlderSameDay,
            foodBudgetLatestSameDay,
            dailyNecessitiesFutureBudget,
          ],
        },
      }),
    )

    const budgets = await fetchCategoryBudgets()

    expect(budgets).toHaveLength(2)
    expect(budgets.find((budget) => budget.categoryId === 10)?.id).toBe(3)
    expect(budgets.find((budget) => budget.categoryId === 20)?.id).toBe(4)
  })

  it("カテゴリ別予算とカテゴリ名を取得する query を送る", async () => {
    const requestCapture: { url: URL | null } = { url: null }

    server.use(
      http.get("*/rest/v1/category_budgets*", ({ request }) => {
        requestCapture.url = new URL(request.url)

        return HttpResponse.json([foodBudgetLatestSameDay])
      }),
    )

    await fetchCategoryBudgets()

    const select = requestCapture.url?.searchParams.get("select")
    expect(select).toContain("id")
    expect(select).toContain("category_id")
    expect(select).toContain("amount")
    expect(select).toContain("effective_from")
    expect(select).toContain("effective_year")
    expect(select).toContain("effective_month")
    expect(select).toContain("user_id")
    expect(select).toContain("created_at")
    expect(select).toContain("updated_at")
    expect(select).toContain("category:categories!category_budgets_category_id_fkey")
    expect(requestCapture.url?.searchParams.get("order")).toBe(
      "category_id.asc,effective_from.desc,id.desc",
    )
    expect(requestCapture.url?.searchParams.has("effective_from")).toBe(false)
  })

  it("Supabase がエラーを返した場合に throw する", async () => {
    server.resetHandlers(
      ...createCategoryBudgetHandlers({
        get: {
          error: true,
        },
      }),
    )

    await expect(fetchCategoryBudgets()).rejects.toThrow("Failed to fetch category budgets.")
  })

  it("レスポンス shape が不正ならエラーにする", async () => {
    server.use(
      http.get("*/rest/v1/category_budgets*", () => {
        return HttpResponse.json([
          {
            id: "invalid",
            amount: 50000,
            category_id: 10,
            effective_from: "2025-03-01",
            effective_year: 2025,
            effective_month: 3,
            user_id: 100,
            created_at: "2025-03-02T00:00:00.000Z",
            updated_at: "2025-03-02T00:00:00.000Z",
            category: {
              id: 10,
              name: "Food",
            },
          },
        ])
      }),
    )

    await expect(fetchCategoryBudgets()).rejects.toThrow("Invalid category budget response")
  })
})
