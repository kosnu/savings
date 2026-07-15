import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { mockSession } from "../../../../test/data/supabaseSession"
import { createProfileHandlers } from "../../../../test/msw/handlers/profile"
import { server } from "../../../../test/msw/server"
import { act, render, screen } from "../../../../test/test-utils"
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
  })

  test("プロフィール取得中はSkeletonを表示する", async () => {
    server.resetHandlers(...createProfileHandlers({ get: { durationOrMode: "infinite" } }))

    await renderAccountInformation()

    expect(screen.getByLabelText("Loading")).toBeInTheDocument()
  })

  test("ログイン方法を解決できない場合は成功値として表示しない", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    const session = mockSession({
      user: {
        ...mockSession().user,
        app_metadata: {},
      },
    })

    await renderAccountInformation({
      sessionState: { status: "authenticated", session },
    })

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load profile information.",
    )
    expect(screen.queryByText("Unknown")).not.toBeInTheDocument()
  })
})
