import { describe, expect, test, vi } from "vite-plus/test"

import { render, screen } from "../../../test/test-utils"
import { CategoryTotals } from "./CategoryTotals"
import type { CategoryTotals as CategoryTotalsData } from "./fetchCategoryTotals"

const categoryTotalsState = vi.hoisted<{
  categoryTotals: CategoryTotalsData
  targetMonthKey: string
}>(() => ({
  categoryTotals: [
    {
      key: "category:10",
      categoryId: 10,
      categoryName: "Food",
      totalAmount: 1000,
      pinned: true,
      kind: "category",
    },
    {
      key: "category:20",
      categoryId: 20,
      categoryName: "Daily Necessities",
      totalAmount: 2000,
      pinned: false,
      kind: "category",
    },
    {
      key: "category:30",
      categoryId: 30,
      categoryName: "Entertainment",
      totalAmount: 3000,
      pinned: false,
      kind: "category",
    },
    {
      key: "uncategorized",
      categoryId: null,
      categoryName: "Unknown",
      totalAmount: 4000,
      pinned: false,
      kind: "uncategorized",
    },
  ],
  targetMonthKey: "2025-06",
}))

vi.mock("./useCategoryTotals", () => ({
  useCategoryTotals: () => categoryTotalsState,
}))

describe("CategoryTotals reset", () => {
  test("Show more後に月が変わると初期表示件数へ戻る", async () => {
    const { rerender, user } = render(<CategoryTotals />)

    expect(await screen.findByText("Food")).toBeInTheDocument()
    expect(screen.queryByText("Unknown")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Show more category totals" }))

    expect(await screen.findByText("Unknown")).toBeInTheDocument()

    categoryTotalsState.targetMonthKey = "2025-07"
    rerender(<CategoryTotals />)

    expect(screen.queryByText("Unknown")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Show more category totals" })).toBeInTheDocument()
  })

  test("Show more後に集計結果が変わると初期表示件数へ戻る", async () => {
    categoryTotalsState.targetMonthKey = "2025-06"
    const { rerender, user } = render(<CategoryTotals />)

    await user.click(await screen.findByRole("button", { name: "Show more category totals" }))
    expect(await screen.findByText("Unknown")).toBeInTheDocument()

    categoryTotalsState.categoryTotals = categoryTotalsState.categoryTotals.map((total) =>
      total.key === "category:10" ? { ...total, totalAmount: total.totalAmount + 1 } : total,
    )
    rerender(<CategoryTotals />)

    expect(screen.queryByText("Unknown")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Show more category totals" })).toBeInTheDocument()
  })
})
