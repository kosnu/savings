import { beforeEach, describe, expect, test } from "vite-plus/test"

import { createCategorySettingsHandlers } from "../../../../test/msw/handlers/categorySettings"
import { server } from "../../../../test/msw/server"
import { render, screen, waitFor, within } from "../../../../test/test-utils"
import { DeleteCategoryModal } from "./DeleteCategoryModal"

const category = {
  id: 10,
  name: "Food",
}

describe("DeleteCategoryModal", () => {
  beforeEach(() => {
    server.resetHandlers(...createCategorySettingsHandlers())
  })

  test("削除確認ダイアログを表示する", async () => {
    const { user } = render(<DeleteCategoryModal category={category} />)

    await user.click(await screen.findByRole("button", { name: "Delete Food category" }))

    const dialog = await screen.findByRole("dialog", {
      name: "Delete this category and its budget?",
    })
    expect(within(dialog).getByText("Food")).toBeInTheDocument()
    expect(
      within(dialog).getByText("Payments using this category will become uncategorized."),
    ).toBeInTheDocument()
  })

  test("削除成功後にダイアログを閉じて成功メッセージを表示する", async () => {
    const { user } = render(<DeleteCategoryModal category={category} />)

    await user.click(await screen.findByRole("button", { name: "Delete Food category" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Delete this category and its budget?",
    })
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }))

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Delete this category and its budget?" }),
      ).not.toBeInTheDocument()
    })
    expect(await screen.findByText("Category deleted successfully.")).toBeInTheDocument()
  })

  test("削除失敗時にダイアログを閉じず失敗メッセージを表示する", async () => {
    server.resetHandlers(...createCategorySettingsHandlers({ delete: { error: true } }))
    const { user } = render(<DeleteCategoryModal category={category} />)

    await user.click(await screen.findByRole("button", { name: "Delete Food category" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Delete this category and its budget?",
    })
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }))

    expect(await screen.findByText("Failed to delete category.")).toBeInTheDocument()
    expect(
      screen.getByRole("dialog", { name: "Delete this category and its budget?" }),
    ).toBeInTheDocument()
  })

  test("カテゴリ未選択時はDeleteを無効化する", async () => {
    const { user } = render(<DeleteCategoryModal category={null} />)

    await user.click(await screen.findByRole("button", { name: "Delete category" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Delete this category and its budget?",
    })

    expect(within(dialog).getByText("Category not found.")).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: /^delete$/i })).toBeDisabled()
  })
})
