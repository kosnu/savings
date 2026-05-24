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
import * as stories from "./UpdateCategoryNameForm.stories"

const { Default } = composeStories(stories)
const CATEGORIES_REST_URL = "*/rest/v1/categories*"

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

  test("カテゴリ名保存中は保存ボタンをローディング表示し操作ボタンを無効化する", async () => {
    const categoryUpdated = createDeferred()

    server.resetHandlers(
      http.patch(CATEGORIES_REST_URL, async () => {
        await categoryUpdated.promise
        return HttpResponse.json({ id: 10 })
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

    expect(await screen.findByText("Failed to update category name.")).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
