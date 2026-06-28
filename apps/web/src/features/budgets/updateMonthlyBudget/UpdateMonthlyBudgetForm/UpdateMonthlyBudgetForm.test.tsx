import { HttpResponse, http } from "msw"
import { describe, expect, test } from "vite-plus/test"

import { monthlyBudgets } from "../../../../test/data/monthlyBudgets"
import { server } from "../../../../test/msw/server"
import { act, render, screen, waitFor, within } from "../../../../test/test-utils"
import { createDeferred } from "../../../../test/utils/createDeferred"
import { normalizeMonthlyBudgetRow, toMonthlyBudget } from "../../monthlyBudgetMappers"
import { UpdateMonthlyBudgetForm } from "./UpdateMonthlyBudgetForm"

const UPDATE_MONTHLY_BUDGET_RPC_URL = "*/rest/v1/rpc/update_current_monthly_budget"

describe("UpdateMonthlyBudgetForm", () => {
  test("月予算更新中は保存ボタンをローディング表示し操作ボタンを無効化する", async () => {
    const monthlyBudgetUpdated = createDeferred()
    const monthlyBudget = toMonthlyBudget(normalizeMonthlyBudgetRow(monthlyBudgets[2]))
    let requestBody: unknown

    server.resetHandlers(
      http.post(UPDATE_MONTHLY_BUDGET_RPC_URL, async ({ request }) => {
        requestBody = await request.json()
        await monthlyBudgetUpdated.promise
        return HttpResponse.json(null)
      }),
    )

    const { user } = render(
      <UpdateMonthlyBudgetForm monthlyBudget={monthlyBudget} onCancel={() => {}} />,
    )
    const amountInput = screen.getByRole("textbox", { name: /amount/i })

    await user.clear(amountInput)
    await user.type(amountInput, "70000")
    await user.click(screen.getByRole("button", { name: "Save" }))

    const saveButton = await screen.findByRole("button", { name: /save/i })
    expect(await within(saveButton).findByLabelText("loading-spinner")).toBeInTheDocument()
    expect(saveButton).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
    expect(requestBody).toEqual({
      p_amount: 70000,
      p_target_month: expect.any(String),
      p_current_month: expect.any(String),
    })
    expect((requestBody as { p_target_month: string }).p_target_month).toBe(
      (requestBody as { p_current_month: string }).p_current_month,
    )

    await act(async () => {
      monthlyBudgetUpdated.resolve()
    })

    await waitFor(() => {
      expect(within(saveButton).queryByLabelText("loading-spinner")).not.toBeInTheDocument()
    })
    expect(saveButton).toBeEnabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled()
  })

  test("金額が不正な文字列の場合は更新せずにエラーを表示する", async () => {
    const monthlyBudget = toMonthlyBudget(normalizeMonthlyBudgetRow(monthlyBudgets[2]))
    let requestCount = 0

    server.resetHandlers(
      http.post(UPDATE_MONTHLY_BUDGET_RPC_URL, () => {
        requestCount += 1
        return HttpResponse.json(null)
      }),
    )

    const { user } = render(
      <UpdateMonthlyBudgetForm monthlyBudget={monthlyBudget} onCancel={() => {}} />,
    )
    const amountInput = screen.getByRole("textbox", { name: /amount/i })

    await user.clear(amountInput)
    await user.type(amountInput, "invalid")
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText("Amount must be a number")).toBeInTheDocument()
    expect(requestCount).toBe(0)
  })
})
