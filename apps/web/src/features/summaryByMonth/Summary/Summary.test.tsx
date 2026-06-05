import { composeStories } from "@storybook/react-vite"
import { describe, expect, test, vi } from "vite-plus/test"

import { monthlyBudgets } from "../../../test/data/monthlyBudgets"
import { createCategoryHandlers } from "../../../test/msw/handlers/categories"
import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { server } from "../../../test/msw/server"
import { render, screen, waitFor } from "../../../test/test-utils"
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

  test("カテゴリ別合計の取得失敗後も月を変更すると再取得して表示する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(
      ...createPaymentHandlers(),
      ...createCategoryHandlers({
        get: { errorOnce: true },
      }),
      ...createMonthlyBudgetHandlers({
        get: { response: { ...monthlyBudgets[2], amount: 25000 } },
      }),
    )
    const { user } = renderStory()

    expect(await screen.findByText("Failed")).toBeInTheDocument()

    await user.click(screen.getByRole("combobox", { name: "Month" }))
    await user.click(await screen.findByRole("option", { name: "5" }))

    await waitFor(() => {
      expect(screen.queryByText("Failed")).not.toBeInTheDocument()
    })
    expect(await screen.findByText("Food")).toBeInTheDocument()
  })
})
