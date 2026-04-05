import { composeStories } from "@storybook/react-vite"
import { describe, expect, test } from "vitest"

import { createCategoryHandlers } from "../../../test/msw/handlers/categories"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { server } from "../../../test/msw/server"
import { render, screen } from "../../../test/test-utils"
import * as stories from "./CategoryTotals.stories"

const { Default } = composeStories(stories)

function renderStory() {
  return render(<Default />)
}

describe("CategoryTotals", () => {
  test("カテゴリ別合計を表示する", async () => {
    server.resetHandlers(...createPaymentHandlers(), ...createCategoryHandlers())
    renderStory()

    expect(await screen.findByText("Food")).toBeInTheDocument()
    expect(screen.getByLabelText(/category totals chunk 0/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/category totals chunk 1/i)).toBeInTheDocument()
    expect(await screen.findByText("Daily Necessities")).toBeInTheDocument()
    expect(await screen.findByText("Entertainment")).toBeInTheDocument()
    expect(await screen.findByText("￥1,000")).toBeInTheDocument()
    expect(await screen.findByText("￥4,000")).toBeInTheDocument()
    expect(await screen.findAllByText("￥0")).toHaveLength(2)
  })
})
