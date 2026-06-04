import { composeStories } from "@storybook/react-vite"
import { describe, expect, test } from "vite-plus/test"

import { monthlyBudgets } from "../../../test/data/monthlyBudgets"
import { createCategoryHandlers } from "../../../test/msw/handlers/categories"
import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { server } from "../../../test/msw/server"
import { render, screen } from "../../../test/test-utils"
import * as stories from "./Summary.stories"

const { Default } = composeStories(stories)

function renderStory() {
  return render(<Default />)
}

describe("Summary", () => {
  test("月次合計とカテゴリ別合計を表示できる", async () => {
    server.resetHandlers(
      ...createPaymentHandlers(),
      ...createCategoryHandlers(),
      ...createMonthlyBudgetHandlers({
        get: { response: { ...monthlyBudgets[2], amount: 25000 } },
      }),
    )
    renderStory()

    expect(await screen.findByLabelText("Total spending")).toBeInTheDocument()
    expect(await screen.findByText("￥5,000")).toBeInTheDocument()
    expect(await screen.findByText("￥20,000 left")).toBeInTheDocument()

    expect(await screen.findByText("Food")).toBeInTheDocument()
    expect(await screen.findByText("Daily Necessities")).toBeInTheDocument()
    expect(await screen.findByText("Entertainment")).toBeInTheDocument()
  })
})
