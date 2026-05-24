import { HttpResponse, http } from "msw"
import { describe, expect, test } from "vite-plus/test"

import { monthlyBudgets } from "../../../../test/data/monthlyBudgets"
import { server } from "../../../../test/msw/server"
import { act, render, screen, waitFor, within } from "../../../../test/test-utils"
import { createDeferred } from "../../../../test/utils/createDeferred"
import { toMonthlyBudget } from "../../monthlyBudgetMappers"
import { UpdateMonthlyBudgetForm } from "./UpdateMonthlyBudgetForm"

const MONTHLY_BUDGETS_REST_URL = "*/rest/v1/monthly_budgets*"

describe("UpdateMonthlyBudgetForm", () => {
  test("月予算更新中は保存ボタンをローディング表示し操作ボタンを無効化する", async () => {
    const monthlyBudgetUpdated = createDeferred()
    const monthlyBudget = toMonthlyBudget(monthlyBudgets[2])

    server.resetHandlers(
      http.patch(MONTHLY_BUDGETS_REST_URL, async () => {
        await monthlyBudgetUpdated.promise
        return HttpResponse.json({ id: monthlyBudget.id })
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

    await act(async () => {
      monthlyBudgetUpdated.resolve()
    })

    await waitFor(() => {
      expect(within(saveButton).queryByLabelText("loading-spinner")).not.toBeInTheDocument()
    })
    expect(saveButton).toBeEnabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled()
  })
})
