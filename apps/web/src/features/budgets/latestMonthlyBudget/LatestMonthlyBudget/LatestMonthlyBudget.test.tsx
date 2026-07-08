import { composeStories } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

import { monthlyBudgets } from "../../../../test/data/monthlyBudgets"
import { createMonthlyBudgetHandlers } from "../../../../test/msw/handlers/monthlyBudgets"
import { server } from "../../../../test/msw/server"
import { act, render, screen, waitFor, within } from "../../../../test/test-utils"
import { POSTGRES_UNIQUE_VIOLATION_CODE } from "../../../../utils/postgresError"
import { fillCreateMonthlyBudgetForm } from "../../test/utils/budgetCreationForm"
import * as stories from "./LatestMonthlyBudget.stories"

const { Default, Empty, FetchError, Loading } = composeStories(stories)
const currentBudgetMonth = getCurrentBudgetMonth()
const createdMonthlyBudget = {
  id: 999,
  book_id: 1,
  amount: 300000,
  created_at: `${currentBudgetMonth.effectiveFrom}T00:00:00.000Z`,
  effective_from: currentBudgetMonth.effectiveFrom,
  effective_month: currentBudgetMonth.monthNumber,
  effective_year: currentBudgetMonth.yearNumber,
  status: "amount" as const,
  updated_at: `${currentBudgetMonth.effectiveFrom}T00:00:00.000Z`,
}

async function renderLatestMonthlyBudget(story: ReactElement) {
  return await act(async () => {
    return render(story, { userOptions: { delay: null } })
  })
}

describe("LatestMonthlyBudget", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test("最新の月予算だけを表示する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: monthlyBudgets[3] },
      }),
    )

    await renderLatestMonthlyBudget(<Default />)

    expect(await screen.findByText("Monthly Budgets")).toBeInTheDocument()
    expect(await screen.findByText("¥75,000")).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "Edit budget" })).toBeInTheDocument()
    expect(screen.queryByText("¥62,000")).not.toBeInTheDocument()
  })

  test("月予算がない場合は作成導線を表示する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: null },
      }),
    )

    await renderLatestMonthlyBudget(<Empty />)

    expect(await screen.findByText("Monthly Budgets")).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "Create budget" })).toBeInTheDocument()
  })

  test("作成成功後に最新の月予算として表示する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: null },
      }),
    )

    const { user, baseElement } = await renderLatestMonthlyBudget(<Empty />)

    await user.click(await screen.findByRole("button", { name: "Create budget" }))
    const dialog = await screen.findByRole("dialog", { name: "Create monthly budget" })
    const body = within(baseElement)

    await fillCreateMonthlyBudgetForm({
      user,
      year: currentBudgetMonth.year,
      month: currentBudgetMonth.month,
      amount: "300000",
      fieldScope: within(dialog),
      optionScope: body,
    })
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: createdMonthlyBudget },
      }),
    )
    await user.click(within(dialog).getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Create monthly budget" }),
      ).not.toBeInTheDocument()
    })
    expect(await screen.findByText("¥300,000")).toBeInTheDocument()
  })

  test("作成失敗時は既存のエラー表示を維持する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: null },
        create: {
          error: true,
          errorResponse: {
            code: POSTGRES_UNIQUE_VIOLATION_CODE,
            message: "duplicate key value violates unique constraint",
          },
        },
      }),
    )

    const { user, baseElement } = await renderLatestMonthlyBudget(<Empty />)

    await user.click(await screen.findByRole("button", { name: "Create budget" }))
    const dialog = await screen.findByRole("dialog", { name: "Create monthly budget" })
    const body = within(baseElement)

    await fillCreateMonthlyBudgetForm({
      user,
      year: currentBudgetMonth.year,
      month: currentBudgetMonth.month,
      amount: "300000",
      fieldScope: within(dialog),
      optionScope: body,
    })
    await user.click(within(dialog).getByRole("button", { name: "Create" }))

    expect(
      await within(dialog).findByText("A monthly budget for this month already exists."),
    ).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Create monthly budget" })).toBeInTheDocument()
  })

  test("編集成功後に最新の月予算表示を更新する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: monthlyBudgets[3] },
      }),
    )

    const { user } = await renderLatestMonthlyBudget(<Default />)

    await user.click(await screen.findByRole("button", { name: "Edit budget" }))
    const dialog = await screen.findByRole("dialog", { name: "Edit monthly budget" })
    const amountInput = within(dialog).getByRole("textbox", { name: /amount/i })

    expect(within(dialog).getByText("Update this month's budget amount.")).toBeInTheDocument()
    expect(within(dialog).getByText("This month")).toBeInTheDocument()
    expect(amountInput).toHaveValue("75000")

    await user.clear(amountInput)
    await user.type(amountInput, "82000")
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: { ...monthlyBudgets[3], amount: 82000 } },
      }),
    )
    await user.click(within(dialog).getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Edit monthly budget" })).not.toBeInTheDocument()
    })
    expect(await screen.findByText("¥82,000")).toBeInTheDocument()
    expect(screen.queryByText("¥75,000")).not.toBeInTheDocument()
  })

  test("編集失敗時はエラー表示を維持してダイアログを閉じない", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: monthlyBudgets[3] },
        update: { error: true },
      }),
    )

    const { user } = await renderLatestMonthlyBudget(<Default />)

    await user.click(await screen.findByRole("button", { name: "Edit budget" }))
    const dialog = await screen.findByRole("dialog", { name: "Edit monthly budget" })
    const amountInput = within(dialog).getByRole("textbox", { name: /amount/i })

    await user.clear(amountInput)
    await user.type(amountInput, "82000")
    await user.click(within(dialog).getByRole("button", { name: "Save" }))

    expect(await within(dialog).findByText("Failed to update monthly budget.")).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Edit monthly budget" })).toBeInTheDocument()
    expect(screen.getByText("¥75,000")).toBeInTheDocument()
  })

  test("削除成功後は予算なしとして作成導線を表示する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: monthlyBudgets[3] },
      }),
    )

    const { user } = await renderLatestMonthlyBudget(<Default />)

    await user.click(await screen.findByRole("button", { name: "Remove budget" }))
    const dialog = await screen.findByRole("dialog", { name: "Remove this month's budget?" })

    expect(
      within(dialog).getByText(
        "This month and future months will have no budget until you create a new one. Past months keep their budget history.",
      ),
    ).toBeInTheDocument()

    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: { status: "none", monthly_budget: null } },
      }),
    )
    await user.click(within(dialog).getByRole("button", { name: "Remove" }))

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Remove this month's budget?" }),
      ).not.toBeInTheDocument()
    })
    expect(await screen.findByRole("button", { name: "Create budget" })).toBeInTheDocument()
    expect(screen.queryByText("¥75,000")).not.toBeInTheDocument()
  })

  test("削除失敗時はエラー表示を維持してダイアログを閉じない", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: monthlyBudgets[3] },
        remove: { error: true },
      }),
    )

    const { user } = await renderLatestMonthlyBudget(<Default />)

    await user.click(await screen.findByRole("button", { name: "Remove budget" }))
    const dialog = await screen.findByRole("dialog", { name: "Remove this month's budget?" })

    await user.click(within(dialog).getByRole("button", { name: "Remove" }))

    expect(await within(dialog).findByText("Failed to remove monthly budget.")).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Remove this month's budget?" })).toBeInTheDocument()
    expect(screen.getByText("¥75,000")).toBeInTheDocument()
  })

  test("取得中はスケルトンを表示する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { response: null, durationOrMode: "infinite" },
      }),
    )

    await renderLatestMonthlyBudget(<Loading />)

    expect(await screen.findByLabelText("loading latest monthly budget")).toBeInTheDocument()
  })

  test("取得に失敗した場合はエラー状態を表示する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        get: { error: true },
      }),
    )

    await renderLatestMonthlyBudget(<FetchError />)

    expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent(
      "Could not load monthly budgets.",
    )
  })
})

function getCurrentBudgetMonth() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  return {
    year: String(year),
    month: String(month),
    yearNumber: year,
    monthNumber: month,
    effectiveFrom: `${year}-${String(month).padStart(2, "0")}-01`,
  }
}
