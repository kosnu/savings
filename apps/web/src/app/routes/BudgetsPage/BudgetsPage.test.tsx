import { afterEach, describe, expect, test, vi } from "vite-plus/test"

import { POSTGRES_UNIQUE_VIOLATION_CODE } from "../../../features/budgets/createMonthlyBudget/monthlyBudgetCreateError"
import { monthlyBudgets } from "../../../test/data/monthlyBudgets"
import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { server } from "../../../test/msw/server"
import { act, render, screen, waitFor, within } from "../../../test/test-utils"
import { BudgetsPage } from "./BudgetsPage"

afterEach(() => {
  vi.restoreAllMocks()
})

async function renderBudgetsPage() {
  return await act(async () => {
    return render(<BudgetsPage />)
  })
}

async function fillCreateMonthlyBudgetForm(
  user: ReturnType<typeof render>["user"],
  dialog: HTMLElement,
  body: ReturnType<typeof within>,
) {
  await user.click(within(dialog).getByRole("combobox", { name: "Year" }))
  await user.click(await body.findByRole("option", { name: "2026" }))
  await user.click(within(dialog).getByRole("combobox", { name: "Month" }))
  await user.click(await body.findByRole("option", { name: "3" }))
  await user.type(within(dialog).getByRole("textbox", { name: /amount/i }), "300000")
}

describe("BudgetsPage", () => {
  test("Budgets 見出しと月予算一覧を表示する", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        list: { response: [monthlyBudgets[3]] },
      }),
    )

    await renderBudgetsPage()

    expect(screen.getByRole("heading", { name: "Budgets" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Create budget" })).toBeInTheDocument()
    expect(await screen.findByRole("table")).toBeInTheDocument()
    expect(await screen.findByText("2025/07")).toBeInTheDocument()
  })

  test("月予算を作成すると一覧に反映される", async () => {
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        list: { response: [monthlyBudgets[3]] },
      }),
    )

    const { user, baseElement } = await renderBudgetsPage()

    await user.click(screen.getByRole("button", { name: "Create budget" }))
    const dialog = await screen.findByRole("dialog", { name: "Create monthly budget" })
    const body = within(baseElement)

    await fillCreateMonthlyBudgetForm(user, dialog, body)
    await user.click(within(dialog).getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Create monthly budget" }),
      ).not.toBeInTheDocument()
    })
    expect(await screen.findByText("2026/03")).toBeInTheDocument()
    expect(await screen.findByText("￥300,000")).toBeInTheDocument()
  })

  test("重複年月エラー時は作成モーダル内にメッセージを表示する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(
      ...createMonthlyBudgetHandlers({
        list: { response: [monthlyBudgets[3]] },
        create: {
          error: true,
          errorResponse: {
            code: POSTGRES_UNIQUE_VIOLATION_CODE,
            message: "duplicate key value violates unique constraint",
          },
        },
      }),
    )

    const { user, baseElement } = await renderBudgetsPage()

    await user.click(screen.getByRole("button", { name: "Create budget" }))
    const dialog = await screen.findByRole("dialog", { name: "Create monthly budget" })
    const body = within(baseElement)

    await fillCreateMonthlyBudgetForm(user, dialog, body)
    await user.click(within(dialog).getByRole("button", { name: "Create" }))

    expect(
      await within(dialog).findByText("A monthly budget for this month already exists."),
    ).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Create monthly budget" })).toBeInTheDocument()
  })
})
