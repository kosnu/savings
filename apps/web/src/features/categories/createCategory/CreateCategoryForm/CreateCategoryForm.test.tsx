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
import * as stories from "./CreateCategoryForm.stories"

const { Default } = composeStories(stories)
const CREATE_CATEGORY_URL = "*/rest/v1/categories*"
const CATEGORY_PINS_URL = "*/rest/v1/category_pins*"

async function renderStory(story: ReactElement) {
  return await act(async () => {
    return render(story)
  })
}

describe("CreateCategoryForm", () => {
  beforeEach(() => {
    server.resetHandlers(...createCategorySettingsHandlers())
  })

  test("カテゴリ名入力欄を表示する", async () => {
    await renderStory(<Default />)

    expect(screen.getByRole("textbox", { name: /Name/ })).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: "Pin category" })).not.toBeChecked()
    expect(screen.queryByRole("textbox", { name: /Monthly budget/ })).not.toBeInTheDocument()
  })

  test("未入力で送信するとカテゴリ名のvalidation errorを表示する", async () => {
    const { user } = await renderStory(<Default />)

    await user.click(screen.getByRole("button", { name: "Create" }))

    expect(await screen.findByText("Category name cannot be empty")).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: /Name/ })).toHaveAttribute("aria-invalid", "true")
  })

  test("20文字超過のカテゴリ名は保存前にvalidation errorを表示する", async () => {
    const { user } = await renderStory(<Default />)

    await user.type(screen.getByRole("textbox", { name: /Name/ }), "a".repeat(21))
    await user.click(screen.getByRole("button", { name: "Create" }))

    expect(
      await screen.findByText("Category name must be 20 characters or less"),
    ).toBeInTheDocument()
  })

  test("有効なカテゴリ名で作成に成功するとonSuccessを呼ぶ", async () => {
    const onSuccess = fn()
    const { user } = await renderStory(<Default onSuccess={onSuccess} />)

    await user.type(screen.getByRole("textbox", { name: /Name/ }), "Groceries")
    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
  })

  test("カテゴリ名で作成リクエストを送る", async () => {
    const onSuccess = fn()
    let requestBody: Record<string, unknown> | undefined

    server.resetHandlers(
      http.post(CREATE_CATEGORY_URL, async ({ request }) => {
        requestBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 999 })
      }),
    )

    const { user } = await renderStory(<Default onSuccess={onSuccess} />)

    await user.type(screen.getByRole("textbox", { name: /Name/ }), "Groceries")
    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
    expect(requestBody).toEqual({
      name: "Groceries",
    })
  })

  test("ピン留めありで作成するとカテゴリ作成後にピン作成リクエストを送る", async () => {
    const onSuccess = fn()
    let pinRequestBody: Record<string, unknown> | undefined

    server.resetHandlers(
      http.post(CREATE_CATEGORY_URL, () => {
        return HttpResponse.json({ id: 999 })
      }),
      http.post(CATEGORY_PINS_URL, async ({ request }) => {
        pinRequestBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ id: 999 })
      }),
    )

    const { user } = await renderStory(<Default onSuccess={onSuccess} />)

    await user.type(screen.getByRole("textbox", { name: /Name/ }), "Groceries")
    await user.click(screen.getByRole("checkbox", { name: "Pin category" }))
    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
    expect(pinRequestBody).toEqual({
      category_id: 999,
    })
  })

  test("作成中は作成ボタンをローディング表示し操作ボタンを無効化する", async () => {
    const categoryCreated = createDeferred()

    server.resetHandlers(
      http.post(CREATE_CATEGORY_URL, async () => {
        await categoryCreated.promise
        return HttpResponse.json({ id: 999 })
      }),
    )

    const { user } = await renderStory(<Default />)

    await user.type(screen.getByRole("textbox", { name: /Name/ }), "Groceries")
    await user.click(screen.getByRole("button", { name: "Create" }))

    const createButton = await screen.findByRole("button", { name: /create/i })
    expect(await within(createButton).findByLabelText("loading-spinner")).toBeInTheDocument()
    expect(createButton).toBeDisabled()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled()
    expect(screen.getByRole("textbox", { name: /Name/ })).toBeDisabled()
    expect(screen.getByRole("checkbox", { name: "Pin category" })).toBeDisabled()

    await act(async () => {
      categoryCreated.resolve()
    })

    await waitFor(() => {
      expect(within(createButton).queryByLabelText("loading-spinner")).not.toBeInTheDocument()
    })
  })

  test("カテゴリ名重複時は保存エラーを表示してonSuccessを呼ばない", async () => {
    const onSuccess = fn()

    server.resetHandlers(
      ...createCategorySettingsHandlers({
        create: {
          error: true,
          errorResponse: {
            code: POSTGRES_UNIQUE_VIOLATION_CODE,
            message: "duplicate key value violates unique constraint",
          },
        },
      }),
    )

    const { user } = await renderStory(<Default onSuccess={onSuccess} />)

    await user.type(screen.getByRole("textbox", { name: /Name/ }), "Food")
    await user.click(screen.getByRole("button", { name: "Create" }))

    expect(await screen.findByText("A category with this name already exists.")).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  test("作成失敗時は汎用エラーを表示してonSuccessを呼ばない", async () => {
    const onSuccess = fn()

    server.resetHandlers(
      ...createCategorySettingsHandlers({
        create: {
          error: true,
        },
      }),
    )

    const { user } = await renderStory(<Default onSuccess={onSuccess} />)

    await user.type(screen.getByRole("textbox", { name: /Name/ }), "Groceries")
    await user.click(screen.getByRole("button", { name: "Create" }))

    expect(await screen.findByText("Failed to create category.")).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
  })

  test("ピン作成失敗時は汎用エラーを表示してonSuccessを呼ばない", async () => {
    const onSuccess = fn()

    server.resetHandlers(
      ...createCategorySettingsHandlers({
        pin: {
          error: true,
        },
      }),
    )

    const { user } = await renderStory(<Default onSuccess={onSuccess} />)

    await user.type(screen.getByRole("textbox", { name: /Name/ }), "Groceries")
    await user.click(screen.getByRole("checkbox", { name: "Pin category" }))
    await user.click(screen.getByRole("button", { name: "Create" }))

    expect(await screen.findByText("Failed to create category.")).toBeInTheDocument()
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
