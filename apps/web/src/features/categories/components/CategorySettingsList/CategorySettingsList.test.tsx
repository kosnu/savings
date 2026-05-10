import { composeStories } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { beforeEach, describe, expect, test } from "vite-plus/test"

import { createCategorySettingsHandlers } from "../../../../test/msw/handlers/categorySettings"
import { server } from "../../../../test/msw/server"
import { act, render, screen, within } from "../../../../test/test-utils"
import * as stories from "./CategorySettingsList.stories"

const { Default } = composeStories(stories)

async function renderCategorySettingsList(story: ReactElement) {
  return await act(async () => {
    return render(story)
  })
}

describe("CategorySettingsList", () => {
  beforeEach(() => {
    server.resetHandlers(...createCategorySettingsHandlers())
  })

  test("カテゴリ名、月予算、ピン状態を表示する", async () => {
    await renderCategorySettingsList(<Default />)

    expect(await screen.findByText("Categories")).toBeInTheDocument()
    expect(screen.getByText("Name")).toBeInTheDocument()
    expect(screen.getAllByText("Monthly budget").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Pin").length).toBeGreaterThan(0)
    expect(await screen.findByText("Food")).toBeInTheDocument()
    expect(screen.getByText("Daily Necessities")).toBeInTheDocument()
    expect(screen.getByText("Entertainment")).toBeInTheDocument()
    expect(screen.getByText("￥50,000")).toBeInTheDocument()
    expect(screen.getAllByText("Not set")).toHaveLength(1)
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
