import { composeStories } from "@storybook/react-vite"
import { delay, HttpResponse, http } from "msw"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { monthlyBudgets } from "../../../../test/data/monthlyBudgets"
import { payments } from "../../../../test/data/payments"
import { createMonthlyBudgetHandlers } from "../../../../test/msw/handlers/monthlyBudgets"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { server } from "../../../../test/msw/server"
import {
  act,
  createTestQueryClient,
  render,
  screen,
  waitFor,
  within,
} from "../../../../test/test-utils"
import { mapPaymentToRow } from "../../../../test/utils/mapPaymentToRow"
import { paymentQueryKeys } from "../../../payments"
import * as stories from "./MonthlySpendingChart.stories"

const { Default, Loading } = composeStories(stories)

function resetHandlers() {
  server.resetHandlers(
    ...createPaymentHandlers(),
    ...createMonthlyBudgetHandlers({ get: { response: { ...monthlyBudgets[2], amount: 15000 } } }),
  )
}

describe("MonthlySpendingChart", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(2025, 5, 15))
    resetHandlers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  test("指定月の支払いと予算を取得してグラフに表示する", async () => {
    render(<Default />)
    expect(await screen.findByText("Within budget · ¥10,000 remaining")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 2, name: "Spending through the month" }),
    ).toBeInTheDocument()
  })

  test("前提データの読み込み中はグラフを取得しない", async () => {
    let requests = 0
    server.use(
      http.get("*/rest/v1/payments", () => {
        requests += 1
        return HttpResponse.json([])
      }),
    )
    render(<Loading />)
    expect(await screen.findByLabelText("Loading spending chart")).toBeInTheDocument()
    expect(requests).toBe(0)
  })

  test("独立した支払いと予算の取得を並行して開始する", async () => {
    let spendingStarted = false
    let budgetStarted = false
    server.use(
      http.get("*/rest/v1/payments", async () => {
        spendingStarted = true
        await delay("infinite")
      }),
      http.post("*/rest/v1/rpc/get_effective_monthly_budget", async () => {
        budgetStarted = true
        await delay("infinite")
      }),
    )
    render(<Default />)
    await waitFor(() => {
      expect(spendingStarted).toBe(true)
      expect(budgetStarted).toBe(true)
    })
    expect(screen.getByLabelText("Loading spending chart")).toBeInTheDocument()
  })

  test.each(["spending", "budget"])("%s 取得失敗から同じ月で再試行して復帰する", async (target) => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.use(
      ...(target === "spending"
        ? createPaymentHandlers({ get: { error: true } })
        : createMonthlyBudgetHandlers({ get: { error: true } })),
    )
    const { user } = render(<Default />)
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the spending chart")
    expect(screen.queryByRole("figure")).not.toBeInTheDocument()
    resetHandlers()
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("Within budget · ¥10,000 remaining")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Spending through the month" })).toHaveFocus()
  })

  test("取得失敗後に月を変更すると、新しい対象月の取得で復帰する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.use(...createPaymentHandlers({ get: { error: true } }))
    const { user } = render(<Default />)
    await screen.findByRole("alert")
    resetHandlers()
    await user.click(screen.getByRole("button", { name: "Previous month" }))
    expect(await screen.findByText("Completed month: actual spending only.")).toBeInTheDocument()
    expect(screen.getByText("Within budget · ¥15,000 remaining")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  test("当月と直近3完了月を同じBookで取得し、過去月表示では履歴を取得しない", async () => {
    const months: string[] = []
    server.use(
      http.get("*/rest/v1/payments", ({ request }) => {
        const params = new URL(request.url).searchParams
        expect(params.get("book_id")).toBe("eq.1")
        const start = params.getAll("date").find((filter) => filter.startsWith("gte."))
        if (!start) throw new Error("対象月がありません")
        months.push(start.slice(4, 11))
      }),
    )
    const { user } = render(<Default />)
    await screen.findByRole("figure")
    expect(months.sort()).toEqual(["2025-03", "2025-04", "2025-05", "2025-06"])
    months.length = 0
    await user.click(screen.getByRole("button", { name: "Previous month" }))
    await screen.findByText("Completed month: actual spending only.")
    expect(months.every((month) => month === "2025-05")).toBe(true)
  })

  test("同じ月を開いたまま翌日の支払いを再取得すると、当日の実績へ含まれる", async () => {
    const queryClient = createTestQueryClient()
    render(<Default />, { queryClient })
    await screen.findByRole("figure")
    vi.setSystemTime(new Date(2025, 5, 16))
    const added = { ...mapPaymentToRow(payments[0]), id: 99, date: "2025-06-16", amount: 2000 }
    server.use(...createPaymentHandlers({ initialRows: [...payments.map(mapPaymentToRow), added] }))
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: paymentQueryKeys.book(1) })
    })
    const figure = await screen.findByRole("figure")
    const actualRow = within(figure).getByText("Actual spending").parentElement?.parentElement
    if (!actualRow) throw new Error("実績額の行がありません")
    expect(actualRow).toHaveTextContent("¥7,000")
  })

  test("履歴取得の失敗は履歴なしと区別し、再試行で復帰する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.use(
      http.get("*/rest/v1/payments", ({ request }) => {
        if (new URL(request.url).searchParams.getAll("date").includes("gte.2025-05-01")) {
          return HttpResponse.json({ message: "failed" }, { status: 500 })
        }
      }),
    )
    const { user } = render(<Default />)
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the spending chart")
    expect(screen.queryByText(/No estimate/)).not.toBeInTheDocument()
    resetHandlers()
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("Within budget · ¥10,000 remaining")).toBeInTheDocument()
  })
})
