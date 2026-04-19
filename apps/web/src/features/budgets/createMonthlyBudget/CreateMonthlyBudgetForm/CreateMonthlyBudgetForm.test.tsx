import { composeStories } from "@storybook/react-vite"
import { HttpResponse, http } from "msw"
import { describe, expect, test, vi } from "vitest"

import { server } from "../../../../test/msw/server"
import { act, render, screen, waitFor } from "../../../../test/test-utils"
import * as stories from "./CreateMonthlyBudgetForm.stories"

const { Default } = composeStories(stories)
const MONTHLY_BUDGETS_REST_URL = "*/rest/v1/monthly_budgets*"

async function renderStory(story: React.ReactElement) {
  return await act(async () => {
    return render(story)
  })
}

async function selectMonth(year: string, month: string, user: ReturnType<typeof render>["user"]) {
  await user.click(screen.getByRole("combobox", { name: "Year" }))
  await user.click(await screen.findByRole("option", { name: year }))

  await user.click(screen.getByRole("combobox", { name: "Month" }))
  await user.click(await screen.findByRole("option", { name: month }))
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

    await selectMonth("2026", "3", user)
    await user.type(screen.getByRole("textbox", { name: /amount/i }), "300000")
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

  test("作成失敗時はonErrorを呼んでonSuccessを呼ばない", async () => {
    const onSuccess = vi.fn()
    const onError = vi.fn()

    server.resetHandlers(
      http.post(MONTHLY_BUDGETS_REST_URL, () => {
        return HttpResponse.json({ message: "Failed to create monthly budget." }, { status: 500 })
      }),
    )

    const { user } = await renderStory(<Default onSuccess={onSuccess} onError={onError} />)

    await selectMonth("2026", "3", user)
    await user.type(screen.getByRole("textbox", { name: /amount/i }), "300000")
    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1)
    })
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
