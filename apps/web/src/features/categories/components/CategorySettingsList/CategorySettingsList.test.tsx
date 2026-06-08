import { composeStories } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { beforeEach, describe, expect, test } from "vite-plus/test"

import {
  type CategorySettingsResponseRow,
  createCategorySettingsHandlers,
} from "../../../../test/msw/handlers/categorySettings"
import { server } from "../../../../test/msw/server"
import { act, render, screen, waitFor, within } from "../../../../test/test-utils"
import * as stories from "./CategorySettingsList.stories"

const { Default } = composeStories(stories)

const defaultCategorySettingsResponse: CategorySettingsResponseRow[] = [
  {
    id: 10,
    book_id: 1,
    name: "Food",
    category_pins: [{ id: 10, category_id: 10 }],
  },
  {
    id: 20,
    book_id: 1,
    name: "Daily Necessities",
    category_pins: [],
  },
  {
    id: 30,
    book_id: 1,
    name: "Entertainment",
    category_pins: [],
  },
]

const renamedCategorySettingsResponse = defaultCategorySettingsResponse.map((row) =>
  row.id === 10 ? { ...row, name: "Groceries" } : row,
)

const createdCategoryResponse: CategorySettingsResponseRow[] = [
  ...defaultCategorySettingsResponse,
  {
    id: 999,
    book_id: 1,
    name: "Groceries",
    category_pins: [],
  },
]

async function renderCategorySettingsList(story: ReactElement) {
  return await act(async () => {
    return render(story)
  })
}

describe("CategorySettingsList", () => {
  beforeEach(() => {
    server.resetHandlers(...createCategorySettingsHandlers())
  })

  test("カテゴリ名とピン状態を表示する", async () => {
    await renderCategorySettingsList(<Default />)

    expect(await screen.findByText("Categories")).toBeInTheDocument()
    expect(screen.getByText("Name")).toBeInTheDocument()
    expect(screen.queryByText("Monthly budget")).not.toBeInTheDocument()
    expect(
      within(screen.getByText("Name").parentElement!).queryByText("Pin"),
    ).not.toBeInTheDocument()
    expect(await screen.findByText("Food")).toBeInTheDocument()
    expect(screen.getByText("Daily Necessities")).toBeInTheDocument()
    expect(screen.getByText("Entertainment")).toBeInTheDocument()
    expect(screen.queryByText("Not set")).not.toBeInTheDocument()
    expect(
      within(screen.getByLabelText("Food category settings")).getAllByText("Pin").length,
    ).toBeGreaterThan(0)
    expect(
      within(screen.getByLabelText("Daily Necessities category settings")).queryByText("Pin"),
    ).not.toBeInTheDocument()
    expect(
      within(screen.getByLabelText("Entertainment category settings")).queryByText("Pin"),
    ).not.toBeInTheDocument()
    expect(screen.queryByText("Pinned")).not.toBeInTheDocument()
    expect(screen.queryByText("Not pinned")).not.toBeInTheDocument()
    expect(
      await screen.findAllByRole("button", { name: /edit .* category name/i }),
    ).not.toHaveLength(0)
    expect(await screen.findAllByRole("button", { name: /delete .* category/i })).not.toHaveLength(
      0,
    )
  })

  test("カテゴリ一覧で金額あり予算だけを表示する", async () => {
    server.resetHandlers(
      ...createCategorySettingsHandlers({
        response: [
          {
            ...defaultCategorySettingsResponse[0]!,
            budget_state: "amount",
            budget_amount: 20000,
          },
          {
            ...defaultCategorySettingsResponse[1]!,
            budget_state: "none",
            budget_amount: null,
          },
          {
            ...defaultCategorySettingsResponse[2]!,
            budget_state: "amount",
            budget_amount: 0,
          },
        ],
      }),
    )

    await renderCategorySettingsList(<Default />)

    expect(
      await within(await screen.findByLabelText("Food category settings")).findByText(
        "Budget ￥20,000",
      ),
    ).toBeInTheDocument()
    expect(
      within(screen.getByLabelText("Entertainment category settings")).getByText("Budget ￥0"),
    ).toBeInTheDocument()
    expect(
      within(screen.getByLabelText("Daily Necessities category settings")).queryByText(/Budget/),
    ).not.toBeInTheDocument()
  })

  test("カテゴリ名を更新して一覧に反映する", async () => {
    server.resetHandlers(
      ...createCategorySettingsHandlers({ response: defaultCategorySettingsResponse }),
    )
    const { user } = await renderCategorySettingsList(<Default />)

    await user.click(
      within(await screen.findByLabelText("Food category settings")).getAllByRole("button", {
        name: /edit food category name/i,
      })[0]!,
    )

    const dialog = await screen.findByRole("dialog", { name: "Edit category" })

    await user.clear(within(dialog).getByRole("textbox", { name: /Name/ }))
    await user.type(within(dialog).getByRole("textbox", { name: /Name/ }), "Groceries")
    server.resetHandlers(
      ...createCategorySettingsHandlers({ response: renamedCategorySettingsResponse }),
    )
    await user.click(within(dialog).getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Edit category" })).not.toBeInTheDocument()
    })
    expect(await screen.findByText("Groceries")).toBeInTheDocument()
    expect(screen.queryByLabelText("Food category settings")).not.toBeInTheDocument()
    expect(await screen.findByLabelText("Groceries category settings")).toBeInTheDocument()
  })

  test("カテゴリを作成して一覧に反映する", async () => {
    server.resetHandlers(
      ...createCategorySettingsHandlers({ response: defaultCategorySettingsResponse }),
    )
    const { user } = await renderCategorySettingsList(<Default />)

    await user.click(await screen.findByRole("button", { name: "Create category" }))
    const dialog = await screen.findByRole("dialog", { name: "Create category" })

    await user.type(within(dialog).getByRole("textbox", { name: /Name/ }), "Groceries")
    server.resetHandlers(...createCategorySettingsHandlers({ response: createdCategoryResponse }))
    await user.click(within(dialog).getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Create category" })).not.toBeInTheDocument()
    })
    expect(await screen.findByLabelText("Groceries category settings")).toBeInTheDocument()
  })

  test("カテゴリを削除して一覧に反映する", async () => {
    server.resetHandlers(
      ...createCategorySettingsHandlers({ response: defaultCategorySettingsResponse }),
    )
    const { user } = await renderCategorySettingsList(<Default />)

    await user.click(
      within(await screen.findByLabelText("Food category settings")).getAllByRole("button", {
        name: /delete food category/i,
      })[0]!,
    )

    const dialog = await screen.findByRole("dialog", { name: "Delete this category?" })
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }))

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Delete this category?" }),
      ).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.queryByLabelText("Food category settings")).not.toBeInTheDocument()
    })
    expect(await screen.findByLabelText("Daily Necessities category settings")).toBeInTheDocument()
    expect(await screen.findByLabelText("Entertainment category settings")).toBeInTheDocument()
  })

  test("カテゴリ削除失敗時は対象カテゴリ行を残す", async () => {
    server.resetHandlers(
      ...createCategorySettingsHandlers({
        response: defaultCategorySettingsResponse,
        delete: { error: true },
      }),
    )
    const { user } = await renderCategorySettingsList(<Default />)

    await user.click(
      within(await screen.findByLabelText("Food category settings")).getAllByRole("button", {
        name: /delete food category/i,
      })[0]!,
    )

    const dialog = await screen.findByRole("dialog", { name: "Delete this category?" })
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }))

    expect(await screen.findByText("Failed to delete category.")).toBeInTheDocument()
    expect(screen.getByRole("dialog", { name: "Delete this category?" })).toBeInTheDocument()
    expect(await screen.findByLabelText("Food category settings")).toBeInTheDocument()
  })

  test("カテゴリ設定取得中は loading を表示する", async () => {
    server.resetHandlers(...createCategorySettingsHandlers({ durationOrMode: "infinite" }))

    await renderCategorySettingsList(<Default />)

    expect(await screen.findByLabelText("loading category settings")).toBeInTheDocument()
  })

  test("カテゴリ設定取得失敗時は error を表示する", async () => {
    server.resetHandlers(...createCategorySettingsHandlers({ error: true }))

    await renderCategorySettingsList(<Default />)

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load categories.")
  })

  test("カテゴリがない場合は empty を表示する", async () => {
    server.resetHandlers(...createCategorySettingsHandlers({ response: [] }))

    await renderCategorySettingsList(<Default />)

    expect(await screen.findByText("No categories.")).toBeInTheDocument()
  })
})
