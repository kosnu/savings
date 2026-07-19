import { composeStories } from "@storybook/react-vite"
import { HttpResponse, http } from "msw"
import type { ReactElement } from "react"
import { afterEach, describe, expect, test, vi } from "vite-plus/test"

import { createProfileHandlers } from "../../../../test/msw/handlers/profile"
import { server } from "../../../../test/msw/server"
import { act, render, screen } from "../../../../test/test-utils"
import * as stories from "./AccountInformation.stories"

const { Default, Loading, LoadError, IdentityProviderFallback, UnavailableLoginMethod } =
  composeStories(stories)

type ProfileStory = typeof Default

function resetHandlersForStory(story: ProfileStory) {
  const createHandlers = story.parameters.profileHandlers as () => ReturnType<
    typeof createProfileHandlers
  >
  server.resetHandlers(...createHandlers())
}

async function renderStory(story: ReactElement) {
  return await act(async () => render(story, { withProviders: false }))
}

describe("AccountInformation", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test("Default Storyでprofileを表示し、保存成功後に再取得値と成功通知を表示する", async () => {
    resetHandlersForStory(Default)
    const { user } = await renderStory(<Default />)

    expect(await screen.findByRole("heading", { name: "Account information" })).toBeInTheDocument()
    const input = await screen.findByRole("textbox", { name: "Display name" })
    expect(input).toHaveValue("Test User")
    expect(await screen.findByText("test@example.com")).toBeInTheDocument()
    expect(await screen.findByText("Google")).toBeInTheDocument()
    expect(screen.getAllByText("Read-only")).toHaveLength(2)
    expect(screen.queryByRole("textbox", { name: "Email address" })).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Login method" })).not.toBeInTheDocument()

    await user.clear(input)
    await user.type(input, "Updated User")
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText("Display name updated.")).toBeInTheDocument()
    expect(await screen.findByRole("textbox", { name: "Display name" })).toHaveValue("Updated User")
  })

  test("表示名の保存中は入力欄と保存ボタンを操作不可にする", async () => {
    server.resetHandlers(...createProfileHandlers({ update: { durationOrMode: 1000 } }))
    const { user } = await renderStory(<Default />)
    const input = await screen.findByRole("textbox", { name: "Display name" })
    const saveButton = screen.getByRole("button", { name: "Save" })

    await user.clear(input)
    await user.type(input, "Pending User")
    await user.click(saveButton)

    expect(input).toBeDisabled()
    expect(saveButton).toBeDisabled()
    expect(screen.getByLabelText("loading-spinner")).toBeInTheDocument()
  })

  test("再取得に失敗した場合は成功通知を出さず入力値を保持する", async () => {
    let getRequestCount = 0
    server.resetHandlers(
      http.get("*/rest/v1/users*", () => {
        getRequestCount += 1

        if (getRequestCount === 2) {
          return HttpResponse.json({ message: "Failed to fetch profile." }, { status: 500 })
        }

        return HttpResponse.json({ name: "Test User", email: "test@example.com" })
      }),
      http.patch("*/rest/v1/users*", () => HttpResponse.json({ auth_user_id: "mock-user-id" })),
    )
    const { user } = await renderStory(<Default />)
    const input = await screen.findByRole("textbox", { name: "Display name" })

    await user.clear(input)
    await user.type(input, "Unsynced User")
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save your display name.")
    expect(screen.getByRole("textbox", { name: "Display name" })).toHaveValue("Unsynced User")
    expect(screen.queryByText("Display name updated.")).not.toBeInTheDocument()
  })

  test("表示名の保存失敗時に入力値を保持してエラーを表示する", async () => {
    server.resetHandlers(...createProfileHandlers({ update: { error: true } }))
    const { user } = await renderStory(<Default />)
    const input = await screen.findByRole("textbox", { name: "Display name" })

    await user.clear(input)
    await user.type(input, "Unsaved User")
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save your display name.")
    expect(screen.getByRole("textbox", { name: "Display name" })).toHaveValue("Unsaved User")
    expect(screen.queryByText("Display name updated.")).not.toBeInTheDocument()
  })

  test("プロフィール取得失敗からTry againで復帰する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(...createProfileHandlers({ get: { errorOnce: true } }))
    const { user } = await renderStory(<LoadError />)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load profile information.",
    )
    await user.click(screen.getByRole("button", { name: "Try again" }))

    expect(await screen.findByRole("textbox", { name: "Display name" })).toHaveValue("Test User")
    expect(screen.getByRole("heading", { name: "Account information" })).toHaveFocus()
  })

  test("Loading StoryでSkeletonを表示する", async () => {
    resetHandlersForStory(Loading)

    await renderStory(<Loading />)

    expect(screen.getByLabelText("Loading")).toBeInTheDocument()
  })

  test("app_metadataが空の場合はidentityのproviderをfallbackに使う", async () => {
    resetHandlersForStory(IdentityProviderFallback)
    await renderStory(<IdentityProviderFallback />)

    expect(await screen.findByText("Google")).toBeInTheDocument()
  })

  test("providerが不明でもプロフィール全体をエラーにしない", async () => {
    resetHandlersForStory(UnavailableLoginMethod)
    await renderStory(<UnavailableLoginMethod />)

    expect(await screen.findByText("Login method unavailable.")).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Display name" })).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
