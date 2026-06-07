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
    const { user } = renderStory()

    expect(await screen.findByText("Food")).toBeInTheDocument()
    expect(screen.getByLabelText(/category totals chunk 0/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/category totals chunk 1/i)).toBeInTheDocument()
    expect(await screen.findByText("Daily Necessities")).toBeInTheDocument()
    expect(await screen.findByText("Entertainment")).toBeInTheDocument()
    expect(screen.queryByText("Unknown")).not.toBeInTheDocument()
    expect(await screen.findByText("￥1,000")).toBeInTheDocument()
    expect(await screen.findByText("￥4,000")).toBeInTheDocument()
    expect(await screen.findByText("Budget ￥20,000")).toBeInTheDocument()
    expect(await screen.findAllByText("￥0")).toHaveLength(1)
    expect(screen.queryByText("Budget ￥0")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Show more category totals" }))

    expect(await screen.findByText("Unknown")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Show more category totals" }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Show less category totals" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Show less category totals" }))

    expect(screen.queryByText("Unknown")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Show more category totals" })).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Show less category totals" }),
    ).not.toBeInTheDocument()
  })

  test("3件以下の場合はShow moreを表示しない", async () => {
    server.resetHandlers(
      ...createCategoryHandlers({
        get: {
          response: [
            {
              id: 10,
              book_id: 1,
              name: "Food",
              created_at: "2025-01-01T00:00:00.000Z",
              updated_at: "2025-01-01T00:00:00.000Z",
            },
            {
              id: 20,
              book_id: 1,
              name: "Daily Necessities",
              created_at: "2025-01-01T00:00:00.000Z",
              updated_at: "2025-01-01T00:00:00.000Z",
            },
          ],
        },
      }),
      ...createPaymentHandlers(),
    )
    renderStory()

    expect(await screen.findByText("Food")).toBeInTheDocument()
    expect(await screen.findByText("Daily Necessities")).toBeInTheDocument()
    expect(await screen.findByText("Unknown")).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Show more category totals" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Show less category totals" }),
    ).not.toBeInTheDocument()
  })

  test("ピン留め優先順の先頭3件を初期表示する", async () => {
    server.resetHandlers(
      ...createCategoryHandlers({
        get: {
          pinnedCategoryIds: [30, 20],
        },
      }),
      ...createPaymentHandlers(),
    )
    renderStory()

    expect(await screen.findByText("Daily Necessities")).toBeInTheDocument()
    expect(await screen.findByText("Entertainment")).toBeInTheDocument()
    expect(await screen.findByText("Food")).toBeInTheDocument()
    expect(screen.queryByText("Unknown")).not.toBeInTheDocument()
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
