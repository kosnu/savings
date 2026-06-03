import { composeStories } from "@storybook/react-vite"
import { HttpResponse, http } from "msw"
import { describe, expect, test, vi } from "vite-plus/test"

import { server } from "../../../../test/msw/server"
import { act, render, screen, waitFor, within } from "../../../../test/test-utils"
import { createDeferred } from "../../../../test/utils/createDeferred"
import { POSTGRES_UNIQUE_VIOLATION_CODE } from "../../../../utils/postgresError"
import { fillCreateMonthlyBudgetForm, selectBudgetMonth } from "../../test/utils/budgetCreationForm"
import * as stories from "./CreateMonthlyBudgetForm.stories"

const { Default } = composeStories(stories)
const CREATE_MONTHLY_BUDGET_RPC_URL = "*/rest/v1/rpc/create_monthly_budget"
const currentBudgetMonth = getCurrentBudgetMonth()

async function renderStory(story: React.ReactElement) {
  return await act(async () => {
    return render(story, { userOptions: { delay: null } })
  })
}

describe("CreateMonthlyBudgetForm", () => {
  test("英語の月と金額入力欄を表示する", async () => {
    await renderStory(<Default />)

    expect(screen.getByText("Month")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Year" })).toHaveTextContent("Select year")
    expect(screen.getByRole("combobox", { name: "Month" })).toHaveTextContent("Select month")
    expect(screen.getByRole("textbox", { name: /amount/i })).toBeInTheDocument()
  })

  test("未入力で送信すると英語のバリデーションエラーを表示する", async () => {
    const { user } = await renderStory(<Default />)

    await user.click(screen.getByRole("button", { name: "Create" }))

    expect(await screen.findByText("Month cannot be empty")).toBeInTheDocument()
    expect(await screen.findByText("Amount cannot be empty")).toBeInTheDocument()
  })

  test("有効な入力では月予算作成hookにwrite inputを渡す", async () => {
    const onSuccess = vi.fn()
    const onError = vi.fn()
    let requestBody: Record<string, unknown> | undefined

    server.resetHandlers(
      http.post(CREATE_MONTHLY_BUDGET_RPC_URL, async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(null, { status: 201 })
      }),
    )

    const { user } = await renderStory(<Default onSuccess={onSuccess} onError={onError} />)

    await fillCreateMonthlyBudgetForm({
      user,
      year: currentBudgetMonth.year,
      month: currentBudgetMonth.month,
      amount: "300000",
    })
    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })

    expect(requestBody).toEqual({
      p_amount: 300000,
      p_effective_month: currentBudgetMonth.effectiveFrom,
    })
    expect(onError).not.toHaveBeenCalled()
  })

  test("金額が不正な文字列の場合は作成せずにエラーを表示する", async () => {
    const onSuccess = vi.fn()
    let requestCount = 0

    server.resetHandlers(
      http.post(CREATE_MONTHLY_BUDGET_RPC_URL, () => {
        requestCount += 1
        return HttpResponse.json([{ id: 999 }], { status: 201 })
      }),
    )

    const { user } = await renderStory(<Default onSuccess={onSuccess} />)

    await fillCreateMonthlyBudgetForm({
      user,
      year: currentBudgetMonth.year,
      month: currentBudgetMonth.month,
      amount: "invalid",
    })
    await user.click(screen.getByRole("button", { name: "Create" }))

    expect(await screen.findByText("Amount must be a number")).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(requestCount).toBe(0)
  })

  test("月予算作成中は作成ボタンをローディング表示し操作ボタンを無効化する", async () => {
    const monthlyBudgetCreated = createDeferred()

    server.resetHandlers(
      http.post(CREATE_MONTHLY_BUDGET_RPC_URL, async () => {
        await monthlyBudgetCreated.promise
        return HttpResponse.json(null, { status: 201 })
      }),
    )

    const { user } = await renderStory(<Default />)

    await fillCreateMonthlyBudgetForm({
      user,
      year: currentBudgetMonth.year,
      month: currentBudgetMonth.month,
      amount: "300000",
    })
    await user.click(screen.getByRole("button", { name: "Create" }))

    const createButton = await screen.findByRole("button", { name: /create/i })
    expect(await within(createButton).findByLabelText("loading-spinner")).toBeInTheDocument()
    expect(createButton).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()

    await act(async () => {
      monthlyBudgetCreated.resolve()
    })

    await waitFor(() => {
      expect(within(createButton).queryByLabelText("loading-spinner")).not.toBeInTheDocument()
    })
    expect(createButton).toBeEnabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled()
  })

  test("重複年月エラー時は重複メッセージを表示する", async () => {
    const onSuccess = vi.fn()
    const onError = vi.fn()

    server.resetHandlers(
      http.post(CREATE_MONTHLY_BUDGET_RPC_URL, () => {
        return HttpResponse.json(
          {
            code: POSTGRES_UNIQUE_VIOLATION_CODE,
            message: "duplicate key value violates unique constraint",
          },
          { status: 500 },
        )
      }),
    )

    const { user } = await renderStory(<Default onSuccess={onSuccess} onError={onError} />)

    await fillCreateMonthlyBudgetForm({
      user,
      year: currentBudgetMonth.year,
      month: currentBudgetMonth.month,
      amount: "300000",
    })
    await user.click(screen.getByRole("button", { name: "Create" }))

    expect(
      await screen.findByText("A monthly budget for this month already exists."),
    ).toBeInTheDocument()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  test("作成失敗時は汎用メッセージを表示してonSuccessを呼ばない", async () => {
    const onSuccess = vi.fn()
    const onError = vi.fn()

    server.resetHandlers(
      http.post(CREATE_MONTHLY_BUDGET_RPC_URL, () => {
        return HttpResponse.json({ message: "Failed to create monthly budget." }, { status: 500 })
      }),
    )

    const { user } = await renderStory(<Default onSuccess={onSuccess} onError={onError} />)

    await fillCreateMonthlyBudgetForm({
      user,
      year: currentBudgetMonth.year,
      month: currentBudgetMonth.month,
      amount: "300000",
    })
    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1)
    })
    expect(await screen.findByText("Failed to create monthly budget.")).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  test("失敗後の再送信では前回のエラーメッセージを消して成功できる", async () => {
    const onSuccess = vi.fn()
    let requestCount = 0

    server.resetHandlers(
      http.post(CREATE_MONTHLY_BUDGET_RPC_URL, () => {
        requestCount += 1

        if (requestCount === 1) {
          return HttpResponse.json(
            {
              code: POSTGRES_UNIQUE_VIOLATION_CODE,
              message: "duplicate key value violates unique constraint",
            },
            { status: 500 },
          )
        }

        return HttpResponse.json(null, { status: 201 })
      }),
    )

    const { user } = await renderStory(<Default onSuccess={onSuccess} />)

    await fillCreateMonthlyBudgetForm({
      user,
      year: currentBudgetMonth.year,
      month: currentBudgetMonth.month,
      amount: "300000",
    })
    await user.click(screen.getByRole("button", { name: "Create" }))

    expect(
      await screen.findByText("A monthly budget for this month already exists."),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
    expect(
      screen.queryByText("A monthly budget for this month already exists."),
    ).not.toBeInTheDocument()
  })

  test("失敗後の再送信がバリデーションで止まる場合も前回のエラーメッセージを消す", async () => {
    const onSuccess = vi.fn()
    const onError = vi.fn()
    let requestCount = 0

    server.resetHandlers(
      http.post(CREATE_MONTHLY_BUDGET_RPC_URL, () => {
        requestCount += 1

        return HttpResponse.json(
          {
            code: POSTGRES_UNIQUE_VIOLATION_CODE,
            message: "duplicate key value violates unique constraint",
          },
          { status: 500 },
        )
      }),
    )

    const { user } = await renderStory(<Default onSuccess={onSuccess} onError={onError} />)

    await selectBudgetMonth({
      user,
      year: currentBudgetMonth.year,
      month: currentBudgetMonth.month,
    })
    const amountInput = screen.getByRole("textbox", { name: /amount/i })
    await user.type(amountInput, "300000")
    await user.click(screen.getByRole("button", { name: "Create" }))

    expect(
      await screen.findByText("A monthly budget for this month already exists."),
    ).toBeInTheDocument()

    await user.clear(amountInput)
    await user.click(screen.getByRole("button", { name: "Create" }))

    expect(await screen.findByText("Amount cannot be empty")).toBeInTheDocument()
    expect(
      screen.queryByText("A monthly budget for this month already exists."),
    ).not.toBeInTheDocument()
    expect(requestCount).toBe(1)
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onSuccess).not.toHaveBeenCalled()
  })
})

function getCurrentBudgetMonth() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  return {
    year: String(year),
    month: String(month),
    effectiveFrom: `${year}-${String(month).padStart(2, "0")}-01`,
  }
}
