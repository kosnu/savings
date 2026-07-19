import { composeStories } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { render, screen, waitFor } from "../../../../test/test-utils"
import * as stories from "./ProfileLoadError.stories"

const { Default, Retrying, RetryFailed } = composeStories(stories)

async function renderStory(story: ReactElement) {
  const result = render(story, { withProviders: false })
  return result
}

describe("ProfileLoadError", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("Default StoryでRetry callbackを1回呼ぶ", async () => {
    const { user } = await renderStory(<Default />)

    await user.click(screen.getByRole("button", { name: "Try again" }))

    expect(Default.args.onRetry).toHaveBeenCalledTimes(1)
  })

  test("Retrying StoryでRetryをpending表示にする", async () => {
    const { container } = await renderStory(<Retrying />)
    await Retrying.play?.({ canvasElement: container })

    const retryButton = screen.getByRole("button", { name: /Try again$/ })
    expect(retryButton).toBeDisabled()
    expect(retryButton).toHaveAttribute("aria-busy", "true")
    expect(screen.getByLabelText("loading-spinner")).toBeInTheDocument()
  })

  test("RetryFailed Storyで失敗後にRetryへfocusを戻す", async () => {
    const { container } = await renderStory(<RetryFailed />)
    await RetryFailed.play?.({ canvasElement: container })

    const retryButton = screen.getByRole("button", { name: "Try again" })
    await waitFor(() => {
      expect(retryButton).toHaveFocus()
      expect(retryButton).toBeEnabled()
    })
  })
})
