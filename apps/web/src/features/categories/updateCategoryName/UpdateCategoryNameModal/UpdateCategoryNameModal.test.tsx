import { composeStories } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { beforeEach, describe, expect, test } from "vite-plus/test"

import { createCategorySettingsHandlers } from "../../../../test/msw/handlers/categorySettings"
import { server } from "../../../../test/msw/server"
import { act, fireEvent, render, screen, waitFor, within } from "../../../../test/test-utils"
import * as stories from "./UpdateCategoryNameModal.stories"

const { Default } = composeStories(stories)

async function renderStory(story: ReactElement) {
  return await act(async () => {
    return render(story)
  })
}

async function openUpdateCategoryNameModal() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /edit food category name/i }))
  })

  return await screen.findByRole("dialog", { name: "Edit category" })
}

describe("UpdateCategoryNameModal", () => {
  beforeEach(() => {
    server.resetHandlers(...createCategorySettingsHandlers())
  })

  test("トリガー操作でダイアログとフォームを表示する", async () => {
    await renderStory(<Default />)

    const dialog = await openUpdateCategoryNameModal()

    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText("Update the category name.")).toBeInTheDocument()
    expect(within(dialog).getByRole("textbox", { name: /Name/ })).toHaveValue("Food")
  })

  test("Cancelをクリックするとダイアログを閉じる", async () => {
    const { user } = await renderStory(<Default />)

    await openUpdateCategoryNameModal()
    await user.click(screen.getByRole("button", { name: "Cancel" }))

    expect(screen.queryByRole("dialog", { name: "Edit category" })).not.toBeInTheDocument()
  })

  test("保存成功後にダイアログを閉じる", async () => {
    const { user } = await renderStory(<Default />)

    const dialog = await openUpdateCategoryNameModal()
    const nameInput = within(dialog).getByRole("textbox", { name: /Name/ })

    await user.clear(nameInput)
    await user.type(nameInput, "Groceries")
    await user.click(within(dialog).getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Edit category" })).not.toBeInTheDocument()
    })
  })

  test("保存失敗時はダイアログを閉じない", async () => {
    server.resetHandlers(
      ...createCategorySettingsHandlers({
        update: {
          error: true,
        },
      }),
    )
    const { user } = await renderStory(<Default />)

    const dialog = await openUpdateCategoryNameModal()
    const nameInput = within(dialog).getByRole("textbox", { name: /Name/ })

    await user.clear(nameInput)
    await user.type(nameInput, "Groceries")
    await user.click(within(dialog).getByRole("button", { name: "Save" }))

    expect(await within(dialog).findByText("Failed to save category.")).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Edit category" })).toBeInTheDocument()
  })
})
