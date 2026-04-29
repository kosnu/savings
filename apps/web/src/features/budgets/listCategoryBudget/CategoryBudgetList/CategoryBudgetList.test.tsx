import { composeStories } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

import { categoryBudgets } from "../../../../test/data/categoryBudgets"
import { createCategoryBudgetHandlers } from "../../../../test/msw/handlers/categoryBudgets"
import { server } from "../../../../test/msw/server"
import { act, render, screen } from "../../../../test/test-utils"
import * as stories from "./CategoryBudgetList.stories"

const { Default, DuplicateCategory, Empty, FetchError, Loading } = composeStories(stories)

async function renderCategoryBudgetList(story: ReactElement) {
  return await act(async () => {
    return render(story)
  })
}

describe("CategoryBudgetList", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test("登録済みカテゴリ別予算をカテゴリ名と金額で表示する", async () => {
    server.resetHandlers(...createCategoryBudgetHandlers())

    await renderCategoryBudgetList(<Default />)

    expect(await screen.findByText("Category Budgets")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add category budget" })).toBeDisabled()
    expect(await screen.findByText("Food ￥50,000")).toBeInTheDocument()
    expect(await screen.findByText("Daily Necessities ￥12,000")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Food category budget menu" })).toBeDisabled()
  })

  test("登録済みカテゴリ別予算がない場合は登録導線を表示する", async () => {
    server.resetHandlers(
      ...createCategoryBudgetHandlers({
        get: { response: [] },
      }),
    )

    await renderCategoryBudgetList(<Empty />)

    expect(await screen.findByRole("button", { name: "Create category budget" })).toBeDisabled()
  })

  test("取得中はスケルトンを表示する", async () => {
    server.resetHandlers(
      ...createCategoryBudgetHandlers({
        get: { response: [], durationOrMode: "infinite" },
      }),
    )

    await renderCategoryBudgetList(<Loading />)

    expect(await screen.findByLabelText("loading category budgets")).toBeInTheDocument()
  })

  test("取得に失敗した場合はエラー状態を表示する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(
      ...createCategoryBudgetHandlers({
        get: { error: true },
      }),
    )

    await renderCategoryBudgetList(<FetchError />)

    expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent(
      "Could not load category budgets.",
    )
  })

  test("同じカテゴリの予算が複数ある場合は最新の1件だけを表示する", async () => {
    server.resetHandlers(
      ...createCategoryBudgetHandlers({
        get: {
          response: [
            {
              ...categoryBudgets[0],
              category: { id: 10, name: "Food" },
            },
            {
              ...categoryBudgets[2],
              category: { id: 10, name: "Food" },
            },
          ],
        },
      }),
    )

    await renderCategoryBudgetList(<DuplicateCategory />)

    expect(await screen.findByText("Food ￥50,000")).toBeInTheDocument()
    expect(screen.queryByText("Food ￥30,000")).not.toBeInTheDocument()
  })
})
