import { composeStories } from "@storybook/react-vite"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

import { monthlyBudgets } from "../../../../test/data/monthlyBudgets"
import { createMonthlyBudgetHandlers } from "../../../../test/msw/handlers/monthlyBudgets"
import { server } from "../../../../test/msw/server"
import { render, screen, waitFor } from "../../../../test/test-utils"
import * as stories from "./MonthlyBudgetUsage.stories"

const { FetchError, Loading, NoBudget, Over, Remaining } = composeStories(stories)
const monthlyBudget = { ...monthlyBudgets[2], amount: 30000 }

describe("MonthlyBudgetUsage", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test("月予算に対する残額を表示する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: monthlyBudget },
      }),
    )
    render(<Remaining />)

    expect(await screen.findByText("￥20,000 left")).toBeInTheDocument()
  })

  test("月予算を超えたら超過額を表示する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: monthlyBudget },
      }),
    )
    render(<Over />)

    expect(await screen.findByText("￥15,000 over")).toHaveAttribute("data-accent-color", "yellow")
  })

  test("月予算がない場合は利用状況を表示しない", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: null },
      }),
    )
    render(<NoBudget />)

    await waitFor(() => {
      expect(screen.queryByText(/left|over|Failed/)).not.toBeInTheDocument()
    })
  })

  test("予算なし状態の場合は利用状況を表示しない", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: { status: "none", monthly_budget: null } },
      }),
    )
    render(<NoBudget />)

    await waitFor(() => {
      expect(screen.queryByText(/left|over|Failed/)).not.toBeInTheDocument()
    })
  })

  test("0円予算は予算ありとして超過額を表示する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: { ...monthlyBudget, amount: 0 } },
      }),
    )
    render(<Remaining />)

    expect(await screen.findByText("￥10,000 over")).toBeInTheDocument()
  })

  test("月予算の取得に失敗した場合はエラー状態を表示する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { error: true },
      }),
    )
    render(<FetchError />)

    const failedStatus = await screen.findByRole("status")

    expect(failedStatus).toHaveTextContent("Failed")
    expect(failedStatus).toHaveAttribute("data-accent-color", "red")
  })

  test("読み込み中はスケルトンを表示する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: monthlyBudget },
      }),
    )
    render(<Loading />)

    expect(await screen.findByTestId("budget-difference-skeleton")).toBeInTheDocument()
  })
})
