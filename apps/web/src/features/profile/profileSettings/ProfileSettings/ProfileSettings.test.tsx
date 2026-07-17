import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { createProfileHandlers } from "../../../../test/msw/handlers/profile"
import { server } from "../../../../test/msw/server"
import { act, render, screen } from "../../../../test/test-utils"
import { ProfileSettings } from "./ProfileSettings"

describe("ProfileSettings", () => {
  beforeEach(() => {
    server.resetHandlers(...createProfileHandlers())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test("プロフィール読み込み中もLanguageSelectを操作できる", async () => {
    server.resetHandlers(...createProfileHandlers({ get: { durationOrMode: "infinite" } }))

    await act(async () => render(<ProfileSettings />))

    expect(screen.getByRole("combobox", { name: "Language" })).toBeEnabled()
  })

  test("プロフィール読み込み失敗時もLanguageSelectを操作できる", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    server.resetHandlers(...createProfileHandlers({ get: { error: true } }))

    await act(async () => render(<ProfileSettings />))

    expect(await screen.findByRole("alert")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Language" })).toBeEnabled()
  })
})
