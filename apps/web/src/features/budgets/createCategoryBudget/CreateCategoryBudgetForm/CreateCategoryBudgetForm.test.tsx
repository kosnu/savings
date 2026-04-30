import { composeStories } from "@storybook/react-vite"
import { HttpResponse, http } from "msw"
import { describe, expect, test, vi } from "vite-plus/test"

import { createCategoryHandlers } from "../../../../test/msw/handlers/categories"
import { createCategoryBudgetHandlers } from "../../../../test/msw/handlers/categoryBudgets"
import { server } from "../../../../test/msw/server"
import { act, render, screen, waitFor, within } from "../../../../test/test-utils"
import { POSTGRES_UNIQUE_VIOLATION_CODE } from "../categoryBudgetCreateError"
import * as stories from "./CreateCategoryBudgetForm.stories"

const { Default } = composeStories(stories)
const CATEGORY_BUDGETS_REST_URL = "*/rest/v1/category_budgets*"

async function renderStory(story: React.ReactElement) {
  return await act(async () => {
    return render(story)
  })
}

describe("CreateCategoryBudgetForm", () => {
  test("カテゴリ、月、金額入力欄を表示する", async () => {
    await renderStory(<Default />)

    expect(await screen.findByRole("combobox", { name: /category/i })).toBeInTheDocument()
    expect(screen.getByText("Month")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Year" })).toHaveTextContent("Select year")
    expect(screen.getByRole("combobox", { name: "Month" })).toHaveTextContent("Select month")
    expect(screen.getByRole("textbox", { name: /amount/i })).toBeInTheDocument()
  })

  test("未入力で送信するとバリデーションエラーを表示する", async () => {
    const { user } = await renderStory(<Default />)

    await user.click(screen.getByRole("button", { name: "Create" }))

    expect(await screen.findByText("Category cannot be empty")).toBeInTheDocument()
    expect(await screen.findByText("Month cannot be empty")).toBeInTheDocument()
    expect(await screen.findByText("Amount cannot be empty")).toBeInTheDocument()
  })

  test("有効な入力で作成に成功するとonSuccessを呼ぶ", async () => {
    const onSuccess = vi.fn()
    const onError = vi.fn()

    server.resetHandlers(...createCategoryHandlers(), ...createCategoryBudgetHandlers())

    const { user } = await renderStory(<Default onSuccess={onSuccess} onError={onError} />)

    await selectCategory(user, "Food")
    await selectMonth("2026", "3", user)
    await user.type(screen.getByRole("textbox", { name: /amount/i }), "50000")
    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })

    expect(onError).not.toHaveBeenCalled()
  })

  test("重複カテゴリ月エラー時は重複メッセージを表示する", async () => {
    const onSuccess = vi.fn()
    const onError = vi.fn()

    server.resetHandlers(
      ...createCategoryHandlers(),
      ...createCategoryBudgetHandlers({
        create: {
          error: true,
          errorResponse: {
            code: POSTGRES_UNIQUE_VIOLATION_CODE,
            message: "duplicate key value violates unique constraint",
          },
        },
      }),
    )

    const { user } = await renderStory(<Default onSuccess={onSuccess} onError={onError} />)

    await selectCategory(user, "Food")
    await selectMonth("2026", "3", user)
    await user.type(screen.getByRole("textbox", { name: /amount/i }), "50000")
    await user.click(screen.getByRole("button", { name: "Create" }))

    expect(
      await screen.findByText("A category budget for this category and month already exists."),
    ).toBeInTheDocument()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onSuccess).not.toHaveBeenCalled()
  })

  test("失敗後の再送信では前回のエラーメッセージを消して成功できる", async () => {
    const onSuccess = vi.fn()
    let requestCount = 0

    server.resetHandlers(
      ...createCategoryHandlers(),
      http.post(CATEGORY_BUDGETS_REST_URL, async ({ request }) => {
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

    await selectCategory(user, "Food")
    await selectMonth("2026", "3", user)
    await user.type(screen.getByRole("textbox", { name: /amount/i }), "50000")
    await user.click(screen.getByRole("button", { name: "Create" }))

    expect(
      await screen.findByText("A category budget for this category and month already exists."),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
    expect(
      screen.queryByText("A category budget for this category and month already exists."),
    ).not.toBeInTheDocument()
  })

  test("作成失敗時は汎用メッセージを表示してonSuccessを呼ばない", async () => {
    const onSuccess = vi.fn()
    const onError = vi.fn()

    server.resetHandlers(
      ...createCategoryHandlers(),
      ...createCategoryBudgetHandlers({
        create: {
          error: true,
          errorResponse: { message: "Failed to create category budget." },
        },
      }),
    )

    const { user } = await renderStory(<Default onSuccess={onSuccess} onError={onError} />)

    await selectCategory(user, "Food")
    await selectMonth("2026", "3", user)
    await user.type(screen.getByRole("textbox", { name: /amount/i }), "50000")
    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1)
    })
    expect(await screen.findByText("Failed to create category budget.")).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
  })
})

async function selectCategory(user: ReturnType<typeof render>["user"], name: string) {
  await user.click(await screen.findByRole("combobox", { name: /category/i }))
  const listbox = await screen.findByRole("listbox")
  await waitFor(() => {
    expect(within(listbox).queryByRole("option", { name: /loading/i })).not.toBeInTheDocument()
  })
  await user.click(await within(listbox).findByRole("option", { name }))
}

async function selectMonth(year: string, month: string, user: ReturnType<typeof render>["user"]) {
  await user.click(screen.getByRole("combobox", { name: "Year" }))
  await user.click(await screen.findByRole("option", { name: year }))

  await user.click(screen.getByRole("combobox", { name: "Month" }))
  await user.click(await screen.findByRole("option", { name: month }))
}
