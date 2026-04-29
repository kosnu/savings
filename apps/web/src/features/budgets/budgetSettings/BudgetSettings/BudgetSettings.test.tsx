import { composeStories } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { describe, expect, test } from "vite-plus/test"

import { createCategoryBudgetHandlers } from "../../../../test/msw/handlers/categoryBudgets"
import { createMonthlyBudgetHandlers } from "../../../../test/msw/handlers/monthlyBudgets"
import { server } from "../../../../test/msw/server"
import { act, render, screen } from "../../../../test/test-utils"
import * as stories from "./BudgetSettings.stories"

const { Default } = composeStories(stories)

async function renderBudgetSettings(story: ReactElement) {
  return await act(async () => {
    return render(story)
  })
}

describe("BudgetSettings", () => {
  test("月予算とカテゴリ別予算を表示する", async () => {
    server.resetHandlers(...createMonthlyBudgetHandlers(), ...createCategoryBudgetHandlers())

    await renderBudgetSettings(<Default />)

    expect(await screen.findByText("Monthly Budgets")).toBeInTheDocument()
    expect(await screen.findByText("Category Budgets")).toBeInTheDocument()
  })
})
