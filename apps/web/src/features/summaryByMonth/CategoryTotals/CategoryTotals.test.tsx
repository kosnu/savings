import { composeStories } from "@storybook/react-vite"
import { describe, expect, test } from "vite-plus/test"

import { payments } from "../../../test/data/payments"
import { createCategoryHandlers } from "../../../test/msw/handlers/categories"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { server } from "../../../test/msw/server"
import { render, screen } from "../../../test/test-utils"
import { mapPaymentToRow } from "../../../test/utils/mapPaymentToRow"
import * as stories from "./CategoryTotals.stories"

import styles from "./CategoryTotals.module.css"

const { Default } = composeStories(stories)

function renderStory() {
  return render(<Default />)
}

function expectAccentColor(element: Element, color: string) {
  expect(element.closest("[data-accent-color]")).toHaveAttribute("data-accent-color", color)
}

describe("CategoryTotals", () => {
  test("カテゴリ別合計を表示する", async () => {
    server.resetHandlers(...createCategoryHandlers(), ...createPaymentHandlers())
    const { user } = renderStory()

    expect(await screen.findByText("Food")).toBeInTheDocument()
    expect(screen.queryByLabelText(/category totals chunk/i)).not.toBeInTheDocument()
    expect(await screen.findByText("Daily Necessities")).toBeInTheDocument()
    expect(await screen.findByText("Entertainment")).toBeInTheDocument()
    expect(screen.queryByText("Uncategorized")).not.toBeInTheDocument()
    expect(await screen.findByText("￥1,000")).toBeInTheDocument()
    expect(await screen.findByText("￥4,000")).toBeInTheDocument()
    expect(await screen.findAllByText("￥0")).toHaveLength(1)
    expect(await screen.findByText("￥29,000 left")).toBeInTheDocument()
    expectAccentColor(await screen.findByText("On budget"), "gray")
    expectAccentColor(await screen.findByText("Not set"), "gray")

    await user.click(screen.getByRole("button", { name: "Show more category totals" }))

    expect(await screen.findByText("Uncategorized")).toHaveClass(styles.systemLabel)
    expect(screen.queryByText("No category")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Show more category totals" }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Show less category totals" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Show less category totals" }))

    expect(screen.queryByText("Uncategorized")).not.toBeInTheDocument()
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
    expect(await screen.findByText("Uncategorized")).toBeInTheDocument()
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
    expect(screen.queryByText("Uncategorized")).not.toBeInTheDocument()
  })

  test("予算超過を差分として表示し、予算なし状態を0差分と混同しない", async () => {
    server.resetHandlers(
      ...createCategoryHandlers({
        get: {
          budgetRows: [
            { category_id: 10, status: "amount", amount: 0 },
            { category_id: 20, status: "none", amount: null },
          ],
        },
      }),
      ...createPaymentHandlers(),
    )
    renderStory()

    expectAccentColor(await screen.findByText("￥1,000 over"), "yellow")
    expect(screen.queryByText("￥4,000 left")).not.toBeInTheDocument()
    expectAccentColor(await screen.findByText("No budget"), "gray")
  })

  test("カテゴリ名、合計額、予算差額を同じ行内の別セルに置く", async () => {
    server.resetHandlers(...createCategoryHandlers(), ...createPaymentHandlers())
    renderStory()

    const categoryName = await screen.findByText("Food")
    const totalAmount = await screen.findByText("￥1,000")
    const budgetDifference = await screen.findByText("￥29,000 left")
    const categoryRow = categoryName.parentElement?.parentElement

    expect(totalAmount.parentElement).toBe(categoryRow)
    expect(budgetDifference.parentElement).toBe(categoryRow)
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

    expect(await screen.findByText("Unknown")).toBeInTheDocument()
    expect(await screen.findByText("Uncategorized")).toBeInTheDocument()
    expect(await screen.findByText("￥700")).toBeInTheDocument()
    expect(await screen.findByText("￥2,500")).toBeInTheDocument()
  })

  test("Uncategorizedという名前のカテゴリと未分類bucketを視覚表現で区別する", async () => {
    const categoryRows = [
      {
        id: 40,
        book_id: 1,
        name: "Uncategorized",
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

    const uncategorizedNames = await screen.findAllByText("Uncategorized")
    expect(uncategorizedNames).toHaveLength(2)
    expect(uncategorizedNames[0]).not.toHaveClass(styles.systemLabel)
    expect(uncategorizedNames[1]).toHaveClass(styles.systemLabel)
    expect(screen.queryByText("No category")).not.toBeInTheDocument()
    expect(await screen.findByText("￥700")).toBeInTheDocument()
    expect(await screen.findByText("￥2,500")).toBeInTheDocument()
  })
})
