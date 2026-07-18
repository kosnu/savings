import { composeStories } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { render, screen } from "../../../../test/test-utils"
import * as stories from "./AccountInformationForm.stories"

const { Default, ValidationError, Saving, SaveError, Saved } = composeStories(stories)

async function renderStory(story: ReactElement) {
  const result = render(story, { withProviders: false })
  return result
}

describe("AccountInformationForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("Default Storyで初期値と読み取り専用値を表示する", async () => {
    await renderStory(<Default />)

    expect(screen.getByRole("textbox", { name: "Display name" })).toHaveValue("Test User")
    expect(screen.getByText("test@example.com")).toBeInTheDocument()
    expect(screen.getByText("Google")).toBeInTheDocument()
    expect(screen.getAllByText("Read-only")).toHaveLength(2)
  })

  test("ValidationError Storyでvalidationとaria属性を表示する", async () => {
    const { container } = await renderStory(<ValidationError />)
    await ValidationError.play?.({ canvasElement: container })

    const input = screen.getByRole("textbox", { name: "Display name" })
    const message = await screen.findByText("Display name cannot be empty")

    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(input).toHaveAccessibleDescription(message.textContent ?? "")
  })

  test("Saving Storyで入力と保存操作を無効化する", async () => {
    await renderStory(<Saving />)

    expect(screen.getByRole("textbox", { name: "Display name" })).toBeDisabled()
    expect(screen.getByRole("button", { name: /Save$/ })).toBeDisabled()
    expect(screen.getByLabelText("loading-spinner")).toBeInTheDocument()
  })

  test("SaveError Storyで入力値を保持してエラーを表示する", async () => {
    const { container } = await renderStory(<SaveError />)
    await SaveError.play?.({ canvasElement: container })

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save your display name.")
    expect(screen.getByRole("textbox", { name: "Display name" })).toHaveValue("Unsaved User")
    expect(screen.queryByText("Display name updated.")).not.toBeInTheDocument()
  })

  test("Saved Storyで成功通知を表示する", async () => {
    const { container } = await renderStory(<Saved />)
    await Saved.play?.({ canvasElement: container })

    expect(await screen.findByText("Display name updated.")).toBeInTheDocument()
  })
})
