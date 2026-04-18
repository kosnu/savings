import { describe, expect, test } from "vitest"

import { monthlyBudgets } from "../../../test/data/monthlyBudgets"
import { createMonthlyBudgetHandlers } from "../../../test/msw/handlers/monthlyBudgets"
import { server } from "../../../test/msw/server"
import { act, render, screen } from "../../../test/test-utils"
import { BudgetsPage } from "./BudgetsPage"

async function renderBudgetsPage() {
  return await act(async () => {
    return render(<BudgetsPage />)
  })
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
    expect(await screen.findByRole("table")).toBeInTheDocument()
    expect(await screen.findByText("2025/07")).toBeInTheDocument()
  })
})
