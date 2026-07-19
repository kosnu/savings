import { composeStories } from "@storybook/react-vite"
import type { ReactElement } from "react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

import type { createProfileHandlers } from "../../../../test/msw/handlers/profile"
import { server } from "../../../../test/msw/server"
import { act, render, screen } from "../../../../test/test-utils"
import * as stories from "./ProfileSettings.stories"

const { ProfileLoading, ProfileError } = composeStories(stories)

type ProfileSettingsStory = typeof ProfileLoading

function resetHandlersForStory(story: ProfileSettingsStory) {
  const createHandlers = story.parameters.profileHandlers as () => ReturnType<
    typeof createProfileHandlers
  >
  server.resetHandlers(...createHandlers())
}

async function renderStory(story: ReactElement) {
  return await act(async () => render(story, { withProviders: false }))
}

describe("ProfileSettings", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test("プロフィール読み込み中もLanguageSelectを操作できる", async () => {
    resetHandlersForStory(ProfileLoading)

    await renderStory(<ProfileLoading />)

    expect(screen.getByRole("combobox", { name: "Language" })).toBeEnabled()
  })

  test("プロフィール読み込み失敗時もLanguageSelectを操作できる", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    resetHandlersForStory(ProfileError)

    await renderStory(<ProfileError />)

    expect(await screen.findByRole("alert")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Language" })).toBeEnabled()
  })
})
