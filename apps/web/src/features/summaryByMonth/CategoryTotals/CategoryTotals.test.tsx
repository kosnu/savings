import { composeStories } from "@storybook/react-vite"
import { describe, expect, test } from "vite-plus/test"

import { payments } from "../../../test/data/payments"
import { createCategoryHandlers } from "../../../test/msw/handlers/categories"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { server } from "../../../test/msw/server"
import { render, screen } from "../../../test/test-utils"
import { mapPaymentToRow } from "../../../test/utils/mapPaymentToRow"
import * as stories from "./CategoryTotals.stories"

const { Default } = composeStories(stories)

function renderStory() {
  return render(<Default />)
}

describe("CategoryTotals", () => {
  test("カテゴリ別合計を表示する", async () => {
    server.resetHandlers(...createCategoryHandlers(), ...createPaymentHandlers())
    renderStory()

    expect(await screen.findByText("Food")).toBeInTheDocument()
    expect(screen.getByLabelText(/category totals chunk 0/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/category totals chunk 1/i)).toBeInTheDocument()
    expect(await screen.findByText("Daily Necessities")).toBeInTheDocument()
    expect(await screen.findByText("Entertainment")).toBeInTheDocument()
    expect(await screen.findByText("Unknown")).toBeInTheDocument()
    expect(await screen.findByText("￥1,000")).toBeInTheDocument()
    expect(await screen.findByText("￥4,000")).toBeInTheDocument()
    expect(await screen.findAllByText("￥0")).toHaveLength(2)
  })

  test("Unknownという名前のカテゴリと未分類支払いを別行で表示する", async () => {
    const categoryRows = [
      {
        id: 40,
        book_id: 1,
        name: "Unknown",
        created_at: "2025-01-01T00:00:00.000Z",
        updated_at: "2025-01-01T00:00:00.000Z",
      },
    ]
    const paymentRows = [
      {
        ...mapPaymentToRow(payments[0]),
        category_id: 40,
        amount: 700,
      },
      {
        ...mapPaymentToRow(payments[1]),
        id: 999,
        category_id: null,
        amount: 2500,
      },
    ]

    server.resetHandlers(
      ...createCategoryHandlers({
        get: {
          response: categoryRows,
          paymentRows,
        },
      }),
      ...createPaymentHandlers({
        initialRows: paymentRows,
      }),
    )
    renderStory()

    expect(await screen.findAllByText("Unknown")).toHaveLength(2)
    expect(await screen.findByText("￥700")).toBeInTheDocument()
    expect(await screen.findByText("￥2,500")).toBeInTheDocument()
  })
})
