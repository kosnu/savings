import { HttpResponse, delay, http } from "msw"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { mockSession } from "../../../../test/data/supabaseSession"
import { createProfileHandlers } from "../../../../test/msw/handlers/profile"
import { server } from "../../../../test/msw/server"
import { act, render, screen, waitFor } from "../../../../test/test-utils"
import { AccountInformation } from "./AccountInformation"

describe("AccountInformation", () => {
  beforeEach(() => {
    server.resetHandlers(...createProfileHandlers())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function renderAccountInformation(options: Parameters<typeof render>[1] = {}) {
    return await act(async () => render(<AccountInformation />, options))
  }

  test("表示名、email、ログイン方法を表示し、emailとログイン方法を読み取り専用にする", async () => {
    await renderAccountInformation()

    expect(await screen.findByRole("heading", { name: "Account information" })).toBeInTheDocument()
    expect(await screen.findByRole("textbox", { name: "Display name" })).toHaveValue("Test User")
    expect(await screen.findByText("test@example.com")).toBeInTheDocument()
    expect(await screen.findByText("Google")).toBeInTheDocument()
    expect(screen.getAllByText("Read-only")).toHaveLength(2)
    expect(screen.queryByRole("textbox", { name: "Email address" })).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Login method" })).not.toBeInTheDocument()
  })

  test("表示名の保存成功後に再取得した値を表示し、成功通知を出す", async () => {
    const { user } = await renderAccountInformation()
    const input = await screen.findByRole("textbox", { name: "Display name" })

    await user.clear(input)
    await user.type(input, "Updated User")
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText("Display name updated.")).toBeInTheDocument()
    expect(await screen.findByRole("textbox", { name: "Display name" })).toHaveValue("Updated User")
  })

  test("表示名の保存中は入力欄と保存ボタンを操作不可にする", async () => {
    server.resetHandlers(...createProfileHandlers({ update: { durationOrMode: 1000 } }))
    const { user } = await renderAccountInformation()
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
    const { user } = await renderAccountInformation()
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
    const { user } = await renderAccountInformation()
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
    const { user } = await renderAccountInformation()

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load profile information.",
    )
    await user.click(screen.getByRole("button", { name: "Try again" }))

    expect(await screen.findByRole("textbox", { name: "Display name" })).toHaveValue("Test User")
    expect(screen.getByRole("heading", { name: "Account information" })).toHaveFocus()
  })

  test("プロフィール再取得中はRetryを操作不可にする", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    let getRequestCount = 0
    server.resetHandlers(
      http.get("*/rest/v1/users*", async () => {
        getRequestCount += 1

        if (getRequestCount === 1) {
          return HttpResponse.json({ message: "Failed to fetch profile." }, { status: 500 })
        }

        await delay(1000)
        return HttpResponse.json({ name: "Test User", email: "test@example.com" })
      }),
    )
    const { user } = await renderAccountInformation()
    const retryButton = await screen.findByRole("button", { name: "Try again" })

    await user.click(retryButton)

    expect(retryButton).toBeDisabled()
    expect(screen.getByLabelText("loading-spinner")).toBeInTheDocument()
  })

  test("プロフィール再取得に失敗した場合はRetryへfocusを戻す", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(...createProfileHandlers({ get: { error: true } }))
    const { user } = await renderAccountInformation()
    const retryButton = await screen.findByRole("button", { name: "Try again" })

    await user.click(retryButton)

    await waitFor(() => {
      expect(retryButton).toHaveFocus()
      expect(retryButton).toBeEnabled()
    })
  })

  test("プロフィール取得中はSkeletonを表示する", async () => {
    server.resetHandlers(...createProfileHandlers({ get: { durationOrMode: "infinite" } }))

    await renderAccountInformation()

    expect(screen.getByLabelText("Loading")).toBeInTheDocument()
  })

  test("app_metadataが空の場合はidentityのproviderをfallbackに使う", async () => {
    const session = mockSession({
      user: {
        ...mockSession().user,
        app_metadata: {},
        identities: [
          {
            id: "mock-identity-id",
            user_id: "mock-user-id",
            identity_id: "mock-identity-id",
            provider: "google",
          },
        ],
      },
    })

    await renderAccountInformation({
      sessionState: { status: "authenticated", session },
    })

    expect(await screen.findByText("Google")).toBeInTheDocument()
  })

  test("providerが不明でもプロフィール全体をエラーにしない", async () => {
    const session = mockSession({
      user: {
        ...mockSession().user,
        app_metadata: {},
      },
    })

    await renderAccountInformation({
      sessionState: { status: "authenticated", session },
    })

    expect(await screen.findByText("Login method unavailable.")).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Display name" })).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
