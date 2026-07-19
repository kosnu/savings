import { composeStories } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { render, screen } from "../../../../test/test-utils"
import * as stories from "./AccountInformationForm.stories"

const {
  Default,
  ValidationError,
  DisplayNameAtLimit,
  DisplayNameTooLong,
  Saving,
  SaveError,
  Saved,
} = composeStories(stories)

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

  test("DisplayNameAtLimit Storyで64文字の表示名を保存する", async () => {
    const { container } = await renderStory(<DisplayNameAtLimit />)
    await DisplayNameAtLimit.play?.({ canvasElement: container })

    expect(DisplayNameAtLimit.args.onSaveDisplayName).toHaveBeenCalledWith("a".repeat(64))
  })

  test("DisplayNameTooLong Storyで65文字を保持して保存を拒否する", async () => {
    const { container } = await renderStory(<DisplayNameTooLong />)
    await DisplayNameTooLong.play?.({ canvasElement: container })

    const input = screen.getByRole("textbox", { name: "Display name" })
    const message = await screen.findByText("Display name must be 64 characters or less")

    expect(input).toHaveValue("a".repeat(65))
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(input).toHaveAccessibleDescription(message.textContent ?? "")
    expect(DisplayNameTooLong.args.onSaveDisplayName).not.toHaveBeenCalled()
  })

  test("Saving Storyで入力と保存操作を無効化する", async () => {
    const { container } = await renderStory(<Saving />)
    await Saving.play?.({ canvasElement: container })

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
