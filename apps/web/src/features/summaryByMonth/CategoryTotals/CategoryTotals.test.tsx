import { composeStories } from "@storybook/react-vite"
import { describe, expect, test, vi } from "vite-plus/test"

import { i18next } from "../../../i18n"
import { payments } from "../../../test/data/payments"
import { createBookHandlers } from "../../../test/msw/handlers/books"
import { createCategoryHandlers } from "../../../test/msw/handlers/categories"
import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { server } from "../../../test/msw/server"
import { act, createTestQueryClient, render, screen } from "../../../test/test-utils"
import { mapPaymentToRow } from "../../../test/utils/mapPaymentToRow"
import { summaryQueryKeys } from "../queryKeys"
import * as stories from "./CategoryTotals.stories"

import styles from "./CategoryTotals.module.css"

const { Default, NoCategories, Loading, FetchError } = composeStories(stories)

function renderStory() {
  return render(<Default />)
}

function expectAccentColor(element: Element, color: string) {
  expect(element.closest("[data-accent-color]")).toHaveAttribute("data-accent-color", color)
}

describe("CategoryTotals", () => {
  test.each([0, 2500])("カテゴリ未登録なら案内と未分類の集計%d円を表示する", async (amount) => {
    const paymentRows =
      amount === 0 ? [] : [{ ...mapPaymentToRow(payments[0]), category_id: null, amount }]
    server.resetHandlers(
      ...createCategoryHandlers({ get: { response: [], paymentRows, budgetRows: [] } }),
      ...createPaymentHandlers({ initialRows: paymentRows }),
    )
    render(<NoCategories />)

    const settingsLink = await screen.findByRole("link", { name: "Book settings" })
    expect(settingsLink.closest("p")).toHaveTextContent(
      "No categories yet; you can add them in Book settings to categorize payments.",
    )
    expect(screen.getByRole("link", { name: "Book settings" })).toHaveAttribute(
      "href",
      "/settings/book",
    )
    expect(screen.getByText("Uncategorized")).toBeInTheDocument()
    expect(screen.getByText(amount === 0 ? "¥0" : "¥2,500")).toBeInTheDocument()
  })

  test("案内のリンクから既存のBook設定へ進める", async () => {
    server.use(
      ...createBookHandlers(),
      ...createMonthlyBudgetHandlers(),
      ...createCategoryHandlers({ get: { response: [], paymentRows: [], budgetRows: [] } }),
      ...createPaymentHandlers({ initialRows: [] }),
    )
    const { user } = render(<NoCategories />)

    await user.click(await screen.findByRole("link", { name: "Book settings" }))

    expect(await screen.findByRole("button", { name: "Create category" })).toBeInTheDocument()
    expect(screen.getByText("No categories.")).toBeInTheDocument()
  })

  test("日本語では設定画面の表記に合わせたリンクを1文の案内に含める", async () => {
    server.resetHandlers(
      ...createCategoryHandlers({ get: { response: [], paymentRows: [], budgetRows: [] } }),
      ...createPaymentHandlers({ initialRows: [] }),
    )
    try {
      await i18next.changeLanguage("ja")
      render(<NoCategories />)

      const settingsLink = await screen.findByRole("link", { name: "設定の「ブック」" })
      expect(settingsLink).toHaveAttribute("href", "/settings/book")
      expect(settingsLink.closest("p")).toHaveTextContent(
        "カテゴリは未登録で、分類したい場合は設定の「ブック」から追加できます。",
      )
    } finally {
      await act(async () => {
        await i18next.changeLanguage("en")
      })
    }
  })

  test("カテゴリ登録後の再取得で未登録の案内が消える", async () => {
    const queryClient = createTestQueryClient()
    server.resetHandlers(
      ...createCategoryHandlers({ get: { response: [], paymentRows: [], budgetRows: [] } }),
      ...createPaymentHandlers({ initialRows: [] }),
    )
    render(<NoCategories />, { queryClient })
    expect(await screen.findByRole("link", { name: "Book settings" })).toBeInTheDocument()

    server.use(...createCategoryHandlers({ get: { paymentRows: [] } }))
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: summaryQueryKeys.categoryTotalsAll })
    })

    expect(await screen.findByText("Food")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Book settings" })).not.toBeInTheDocument()
    expect(screen.queryByText(/No categories yet/)).not.toBeInTheDocument()
  })

  test("登録カテゴリがあれば対象月の支払いが0件でも未登録の案内を出さない", async () => {
    server.resetHandlers(
      ...createCategoryHandlers({ get: { paymentRows: [] } }),
      ...createPaymentHandlers({ initialRows: [] }),
    )
    renderStory()

    expect(await screen.findByText("Food")).toBeInTheDocument()
    expect(screen.getAllByText("¥0")).toHaveLength(3)
    expect(screen.queryByRole("link", { name: "Book settings" })).not.toBeInTheDocument()
    expect(screen.queryByText(/No categories yet/)).not.toBeInTheDocument()
  })

  test("取得中は未登録の案内を出さない", async () => {
    server.resetHandlers(
      ...createCategoryHandlers({ get: { durationOrMode: "infinite" } }),
      ...createPaymentHandlers(),
    )
    render(<Loading />)

    expect(await screen.findByLabelText("loading category totals")).toBeInTheDocument()
    expect(screen.queryByText(/No categories yet/)).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Book settings" })).not.toBeInTheDocument()
  })

  test("取得失敗は未登録の案内に置き換えない", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(
      ...createCategoryHandlers({ get: { error: true } }),
      ...createPaymentHandlers(),
    )
    render(<FetchError />)

    expect(await screen.findByText("Failed")).toBeInTheDocument()
    expect(screen.queryByText(/No categories yet/)).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Book settings" })).not.toBeInTheDocument()
  })

  test("カテゴリ別合計を表示する", async () => {
    server.resetHandlers(...createCategoryHandlers(), ...createPaymentHandlers())
    const { user } = renderStory()

    expect(await screen.findByText("Food")).toBeInTheDocument()
    expect(screen.queryByLabelText(/category totals chunk/i)).not.toBeInTheDocument()
    expect(await screen.findByText("Daily Necessities")).toBeInTheDocument()
    expect(await screen.findByText("Entertainment")).toBeInTheDocument()
    expect(screen.queryByText("Uncategorized")).not.toBeInTheDocument()
    expect(await screen.findByText("¥1,000")).toBeInTheDocument()
    expect(await screen.findByText("¥4,000")).toBeInTheDocument()
    expect(await screen.findAllByText("¥0")).toHaveLength(1)
    expect(await screen.findByText("¥29,000 left")).toBeInTheDocument()
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

    expectAccentColor(await screen.findByText("¥1,000 over"), "yellow")
    expect(screen.queryByText("¥4,000 left")).not.toBeInTheDocument()
    expectAccentColor(await screen.findByText("No budget"), "gray")
    expect(screen.getAllByRole("progressbar")).toHaveLength(1)
    expect(
      screen.queryByRole("progressbar", { name: "Daily Necessities budget progress" }),
    ).not.toBeInTheDocument()
  })

  test("カテゴリ名と合計額の行の下に、Progressと予算差額を表示する", async () => {
    server.resetHandlers(...createCategoryHandlers(), ...createPaymentHandlers())
    renderStory()

    const categoryName = await screen.findByText("Food")
    const totalAmount = await screen.findByText("¥1,000")
    const budgetDifference = await screen.findByText("¥29,000 left")
    const categoryHeader = totalAmount.parentElement
    const progress = screen.getByRole("progressbar", { name: "Food budget progress" })
    const categoryTotal = categoryHeader?.parentElement

    expect(categoryHeader).toContainElement(categoryName)
    expect(categoryTotal?.children[1]).toBe(progress)
    expect(categoryTotal?.children[2]).toContainElement(budgetDifference)
    expect(progress).toHaveAttribute("aria-valuetext", "Spent ¥1,000 of ¥30,000. ¥29,000 left.")
    expect(screen.getAllByRole("progressbar")).toHaveLength(2)
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
    expect(await screen.findByText("¥700")).toBeInTheDocument()
    expect(await screen.findByText("¥2,500")).toBeInTheDocument()
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
    expect(await screen.findByText("¥700")).toBeInTheDocument()
    expect(await screen.findByText("¥2,500")).toBeInTheDocument()
  })
})
