import { composeStories } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { beforeEach, describe, expect, test } from "vite-plus/test"

import { createCategorySettingsHandlers } from "../../../../test/msw/handlers/categorySettings"
import { server } from "../../../../test/msw/server"
import { act, fireEvent, render, screen, waitFor, within } from "../../../../test/test-utils"
import * as stories from "./CreateCategoryModal.stories"

const { Default } = composeStories(stories)

async function renderStory(story: ReactElement) {
  return await act(async () => {
    return render(story)
  })
}

async function openCreateCategoryModal() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Create category" }))
  })

  return await screen.findByRole("dialog", { name: "Create category" })
}

describe("CreateCategoryModal", () => {
  beforeEach(() => {
    server.resetHandlers(...createCategorySettingsHandlers())
  })

  test("トリガー操作でダイアログとフォームを表示する", async () => {
    await renderStory(<Default />)

    const dialog = await openCreateCategoryModal()

    expect(dialog).toBeInTheDocument()
    expect(
      within(dialog).getByText("Create a category with an optional monthly budget amount."),
    ).toBeInTheDocument()
    expect(within(dialog).getByRole("textbox", { name: /Name/ })).toBeInTheDocument()
    expect(within(dialog).getByRole("textbox", { name: /Monthly budget/ })).toBeInTheDocument()
  })

  test("Cancelをクリックするとダイアログを閉じる", async () => {
    const { user } = await renderStory(<Default />)

    await openCreateCategoryModal()
    await user.click(screen.getByRole("button", { name: "Cancel" }))

    expect(screen.queryByRole("dialog", { name: "Create category" })).not.toBeInTheDocument()
  })

  test("作成成功後にダイアログを閉じる", async () => {
    const { user } = await renderStory(<Default />)
    const dialog = await openCreateCategoryModal()

    await user.type(within(dialog).getByRole("textbox", { name: /Name/ }), "Groceries")
    await user.click(within(dialog).getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Create category" })).not.toBeInTheDocument()
    })
  })

  test("作成失敗時はダイアログを閉じない", async () => {
    server.resetHandlers(
      ...createCategorySettingsHandlers({
        create: {
          error: true,
        },
      }),
    )
    const { user } = await renderStory(<Default />)
    const dialog = await openCreateCategoryModal()

    await user.type(within(dialog).getByRole("textbox", { name: /Name/ }), "Groceries")
    await user.click(within(dialog).getByRole("button", { name: "Create" }))

    expect(await within(dialog).findByText("Failed to create category.")).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Create category" })).toBeInTheDocument()
  })
})
