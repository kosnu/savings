import { composeStories } from "@storybook/react-vite"
import { HttpResponse, http } from "msw"
import type { ReactElement } from "react"
import { fn } from "storybook/test"
import { beforeEach, describe, expect, test } from "vite-plus/test"

import { createCategorySettingsHandlers } from "../../../../test/msw/handlers/categorySettings"
import { server } from "../../../../test/msw/server"
import { act, render, screen, waitFor, within } from "../../../../test/test-utils"
import { createDeferred } from "../../../../test/utils/createDeferred"
import { POSTGRES_UNIQUE_VIOLATION_CODE } from "../../../../utils/postgresError"
import { categoryPinLimitErrorMessage } from "../../categoryPinLimitError"
import * as stories from "./UpdateCategoryNameForm.stories"

const { Default } = composeStories(stories)
const UPDATE_CATEGORY_WITH_PIN_URL = "*/rest/v1/rpc/update_category_with_pin_and_budget"

async function renderStory(story: ReactElement) {
  return await act(async () => {
    return render(story)
  })
}

describe("UpdateCategoryNameForm", () => {
  beforeEach(() => {
    server.resetHandlers(...createCategorySettingsHandlers())
  })

  test("カテゴリ名の初期値を表示する", async () => {
    await renderStory(<Default />)

    expect(screen.getByRole("textbox", { name: /Name/ })).toHaveValue("Food")
    expect(screen.getByRole("textbox", { name: "Budget" })).toHaveValue("")
    expect(screen.getByText("Leave blank for no category budget.")).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: "Pin category" })).toBeChecked()
  })

  test("CancelをクリックするとonCancelを呼ぶ", async () => {
    const onCancel = fn()
    const { user } = await renderStory(<Default onCancel={onCancel} />)

    await user.click(screen.getByRole("button", { name: "Cancel" }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  test("空文字のカテゴリ名は保存前にエラーを表示する", async () => {
    const onSuccess = fn()
    const { user } = await renderStory(<Default onSuccess={onSuccess} />)
    const nameInput = screen.getByRole("textbox", { name: /Name/ })

    await user.clear(nameInput)
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText("Category name cannot be empty")).toBeInTheDocument()
    expect(nameInput).toHaveAttribute("aria-invalid", "true")
    expect(nameInput).toHaveAccessibleDescription("Category name cannot be empty")
    expect(onSuccess).not.toHaveBeenCalled()
  })

  test("有効なカテゴリ名で保存に成功するとonSuccessを呼ぶ", async () => {
    const onSuccess = fn()
    const { user } = await renderStory(<Default onSuccess={onSuccess} />)
    const nameInput = screen.getByRole("textbox", { name: /Name/ })

    await user.clear(nameInput)
    await user.type(nameInput, "Groceries")
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
  })

  test("ピン状態だけを変更して保存できる", async () => {
    const onSuccess = fn()
    let requestBody: Record<string, unknown> | undefined

    server.resetHandlers(
      http.post(UPDATE_CATEGORY_WITH_PIN_URL, async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(null)
      }),
    )

    const { user } = await renderStory(<Default onSuccess={onSuccess} />)

    await user.click(screen.getByRole("checkbox", { name: "Pin category" }))
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
    expect(requestBody).toEqual({
      p_budget_action: "keep",
      p_budget_amount: null,
      p_category_id: 10,
      p_category_name: "Food",
      p_effective_month: expect.any(String),
      p_pinned: false,
    })
  })

  test("カテゴリ名とピン状態を同時に変更して保存できる", async () => {
    const onSuccess = fn()
    let requestBody: Record<string, unknown> | undefined

    server.resetHandlers(
      http.post(UPDATE_CATEGORY_WITH_PIN_URL, async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(null)
      }),
    )

    const { user } = await renderStory(<Default onSuccess={onSuccess} />)
    const nameInput = screen.getByRole("textbox", { name: /Name/ })

    await user.clear(nameInput)
    await user.type(nameInput, "Groceries")
    await user.click(screen.getByRole("checkbox", { name: "Pin category" }))
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
    expect(requestBody).toEqual({
      p_budget_action: "keep",
      p_budget_amount: null,
      p_category_id: 10,
      p_category_name: "Groceries",
      p_effective_month: expect.any(String),
      p_pinned: false,
    })
  })

  test("予算額を入力するとset actionで保存する", async () => {
    const onSuccess = fn()
    let requestBody: Record<string, unknown> | undefined

    server.resetHandlers(
      http.post(UPDATE_CATEGORY_WITH_PIN_URL, async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(null)
      }),
    )

    const { user } = await renderStory(<Default onSuccess={onSuccess} />)

    await user.type(screen.getByRole("textbox", { name: "Budget" }), "0")
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
    expect(requestBody).toEqual({
      p_budget_action: "set",
      p_budget_amount: 0,
      p_category_id: 10,
      p_category_name: "Food",
      p_effective_month: expect.any(String),
      p_pinned: true,
    })
  })

  test("既存予算を空欄にするとunset actionで保存する", async () => {
    const onSuccess = fn()
    let requestBody: Record<string, unknown> | undefined

    server.resetHandlers(
      http.post(UPDATE_CATEGORY_WITH_PIN_URL, async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json(null)
      }),
    )

    const { user } = await renderStory(
      <Default
        category={{
          id: 10,
          name: "Food",
          pinned: true,
          budgetStatus: "amount",
          budgetAmount: 5000,
        }}
        onSuccess={onSuccess}
      />,
    )

    const budgetInput = screen.getByRole("textbox", { name: "Budget" })
    expect(budgetInput).toHaveValue("5000")

    await user.clear(budgetInput)
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
    expect(requestBody).toEqual({
      p_budget_action: "unset",
      p_budget_amount: null,
      p_category_id: 10,
      p_category_name: "Food",
      p_effective_month: expect.any(String),
      p_pinned: true,
    })
  })

  test("変更なしで保存するとmutationを呼ばずにonSuccessを呼ぶ", async () => {
    const onSuccess = fn()
    let requestCount = 0

    server.resetHandlers(
      http.post(UPDATE_CATEGORY_WITH_PIN_URL, () => {
        requestCount += 1
        return HttpResponse.json(null)
      }),
    )

    const { user } = await renderStory(<Default onSuccess={onSuccess} />)

    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
    expect(requestCount).toBe(0)
  })

  test("カテゴリ名保存中は保存ボタンをローディング表示し操作ボタンを無効化する", async () => {
    const categoryUpdated = createDeferred()

    server.resetHandlers(
      http.post(UPDATE_CATEGORY_WITH_PIN_URL, async () => {
        await categoryUpdated.promise
        return HttpResponse.json(null)
      }),
    )

    const { user } = await renderStory(<Default />)
    const nameInput = screen.getByRole("textbox", { name: /Name/ })

    await user.clear(nameInput)
    await user.type(nameInput, "Groceries")
    await user.click(screen.getByRole("button", { name: "Save" }))

    const saveButton = await screen.findByRole("button", { name: /save/i })
    expect(await within(saveButton).findByLabelText("loading-spinner")).toBeInTheDocument()
    expect(saveButton).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
    expect(screen.getByRole("textbox", { name: "Budget" })).toBeDisabled()
    expect(screen.getByRole("checkbox", { name: "Pin category" })).toBeDisabled()

    await act(async () => {
      categoryUpdated.resolve()
    })

    await waitFor(() => {
      expect(within(saveButton).queryByLabelText("loading-spinner")).not.toBeInTheDocument()
    })
    expect(saveButton).toBeEnabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled()
  })

  test("カテゴリ名重複時は保存エラーを表示してonSuccessを呼ばない", async () => {
    server.resetHandlers(
      ...createCategorySettingsHandlers({
        update: {
          error: true,
          errorResponse: {
            code: POSTGRES_UNIQUE_VIOLATION_CODE,
            message: "duplicate key value violates unique constraint",
          },
        },
      }),
    )
    const onSuccess = fn()
    const { user } = await renderStory(<Default onSuccess={onSuccess} />)
    const nameInput = screen.getByRole("textbox", { name: /Name/ })

    await user.clear(nameInput)
    await user.type(nameInput, "Daily Necessities")
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText("A category with this name already exists.")).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  test("カテゴリ名保存失敗時は汎用エラーを表示してonSuccessを呼ばない", async () => {
    server.resetHandlers(
      ...createCategorySettingsHandlers({
        update: {
          error: true,
        },
      }),
    )
    const onSuccess = fn()
    const { user } = await renderStory(<Default onSuccess={onSuccess} />)
    const nameInput = screen.getByRole("textbox", { name: /Name/ })

    await user.clear(nameInput)
    await user.type(nameInput, "Groceries")
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText("Failed to save category.")).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  test("pin数が3件ある状態で未ピン留めカテゴリをピン留めするとRPCを呼ばずエラーを表示する", async () => {
    let requestCount = 0

    server.resetHandlers(
      http.post(UPDATE_CATEGORY_WITH_PIN_URL, () => {
        requestCount += 1
        return HttpResponse.json(null)
      }),
    )
    const onSuccess = fn()
    const { user } = await renderStory(
      <Default
        category={{ id: 20, name: "Daily Necessities", pinned: false }}
        currentPinnedCount={3}
        onSuccess={onSuccess}
      />,
    )

    await user.click(screen.getByRole("checkbox", { name: "Pin category" }))
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText(categoryPinLimitErrorMessage)).toBeInTheDocument()
    expect(screen.queryByText("Failed to save category.")).not.toBeInTheDocument()
    expect(requestCount).toBe(0)
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
