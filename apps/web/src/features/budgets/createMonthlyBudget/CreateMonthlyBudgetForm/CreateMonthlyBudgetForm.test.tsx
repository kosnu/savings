import { composeStories } from "@storybook/react-vite"
import { HttpResponse, http } from "msw"
import { describe, expect, test, vi } from "vite-plus/test"

import { server } from "../../../../test/msw/server"
import { act, render, screen, waitFor } from "../../../../test/test-utils"
import { fillCreateMonthlyBudgetForm, selectBudgetMonth } from "../../test/utils/budgetCreationForm"
import { POSTGRES_UNIQUE_VIOLATION_CODE } from "../monthlyBudgetCreateError"
import * as stories from "./CreateMonthlyBudgetForm.stories"

const { Default } = composeStories(stories)
const MONTHLY_BUDGETS_REST_URL = "*/rest/v1/monthly_budgets*"

async function renderStory(story: React.ReactElement) {
  return await act(async () => {
    return render(story)
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
      http.post(MONTHLY_BUDGETS_REST_URL, async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json([{ id: 999, ...requestBody }], { status: 201 })
      }),
    )

    const { user } = await renderStory(<Default onSuccess={onSuccess} onError={onError} />)

    await fillCreateMonthlyBudgetForm({ user, year: "2026", month: "3", amount: "300000" })
    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })

    expect(requestBody).toEqual({
      amount: 300000,
      effective_from: "2026-03-01",
    })
    expect(onError).not.toHaveBeenCalled()
  })

  test("重複年月エラー時は重複メッセージを表示する", async () => {
    const onSuccess = vi.fn()
    const onError = vi.fn()

    server.resetHandlers(
      http.post(MONTHLY_BUDGETS_REST_URL, () => {
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

    await fillCreateMonthlyBudgetForm({ user, year: "2026", month: "3", amount: "300000" })
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
      http.post(MONTHLY_BUDGETS_REST_URL, () => {
        return HttpResponse.json({ message: "Failed to create monthly budget." }, { status: 500 })
      }),
    )

    const { user } = await renderStory(<Default onSuccess={onSuccess} onError={onError} />)

    await fillCreateMonthlyBudgetForm({ user, year: "2026", month: "3", amount: "300000" })
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
      http.post(MONTHLY_BUDGETS_REST_URL, async ({ request }) => {
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

        const requestBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json([{ id: 999, ...requestBody }], { status: 201 })
      }),
    )

    const { user } = await renderStory(<Default onSuccess={onSuccess} />)

    await fillCreateMonthlyBudgetForm({ user, year: "2026", month: "3", amount: "300000" })
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
      http.post(MONTHLY_BUDGETS_REST_URL, () => {
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

    await selectBudgetMonth({ user, year: "2026", month: "3" })
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
