import { composeStories } from "@storybook/react-vite"
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { i18next } from "../../i18n"
import { cleanup, createTestQueryClient, render, screen, waitFor } from "../../test/test-utils"
import * as stories from "./Sidebar.stories"

const mockSignOut = vi.fn()
const mockAuth = {
  signOut: (...args: unknown[]) => mockSignOut(...args),
  setSession: vi.fn(),
}

vi.mock("../../lib/supabase", () => ({
  getSupabaseClient: () => ({
    auth: mockAuth,
  }),
}))

const { Default, Closed, LoggingOut, LogoutError } = composeStories(stories)

describe("Sidebar", () => {
  beforeEach(() => {
    mockSignOut.mockReset()
    mockSignOut.mockResolvedValue({ error: null })
    mockAuth.setSession.mockClear()
  })

  afterEach(async () => {
    await Default.load()
    vi.restoreAllMocks()
  })

  describe.each([
    ["ja", "ログアウト"],
    ["en", "Log out"],
  ] as const)("%s", (language, logoutLabel) => {
    test.each([
      ["LoggingOut", LoggingOut],
      ["LogoutError", LogoutError],
    ] as const)(
      "%s story は認証セッションを作らず、終了後に通常のログアウトへ戻る",
      async (_, Story) => {
        const originalLanguage = i18next.language
        const originalSavedLanguage = localStorage.getItem("appLanguage")
        await i18next.changeLanguage(language)
        try {
          vi.spyOn(console, "error").mockImplementation(() => undefined)
          const originalSignOut = mockAuth.signOut
          await Story.load()
          const { container, unmount } = render(<Story />)

          expect(await screen.findByRole("button", { name: logoutLabel })).toBeEnabled()
          await Story.play!({ canvasElement: container })

          expect(mockAuth.setSession).not.toHaveBeenCalled()
          expect(mockSignOut).not.toHaveBeenCalled()
          unmount()
          await Default.load()
          expect(mockAuth.signOut).toBe(originalSignOut)

          const onClose = vi.fn()
          const { user } = render(<Default onClose={onClose} />)
          await user.click(await screen.findByRole("button", { name: logoutLabel }))
          expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" })
          await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
          expect(screen.queryByRole("alert")).not.toBeInTheDocument()
        } finally {
          cleanup()
          await i18next.changeLanguage(originalLanguage)
          if (originalSavedLanguage === null) {
            localStorage.removeItem("appLanguage")
          } else {
            localStorage.setItem("appLanguage", originalSavedLanguage)
          }
        }
      },
    )
  })

  test("Default story では開いたサイドバーを表示する", async () => {
    render(<Default />)

    const sidebar = await screen.findByRole("complementary")
    expect(await screen.findByText("Burneto")).toBeInTheDocument()
    expect(await screen.findByText("Sidebar Content")).toBeInTheDocument()
    expect(sidebar).toHaveAttribute("data-open", "true")
  })

  test("Closed story では閉じた状態を表示する", async () => {
    render(<Closed />)

    const sidebar = await screen.findByRole("complementary")
    expect(await screen.findByText("Burneto")).toBeInTheDocument()
    expect(await screen.findByText("Sidebar Content")).toBeInTheDocument()
    expect(sidebar).toHaveAttribute("data-open", "false")
  })

  test("開いている状態でサイドバー領域外をクリックすると onClose を呼ぶ", async () => {
    const onClose = vi.fn()
    const { user } = render(<Default onClose={onClose} />)

    await user.click(await screen.findByTestId("sidebar-backdrop"))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test("サイドバー内をクリックしても領域外クリックとして onClose を呼ばない", async () => {
    const onClose = vi.fn()
    const { user } = render(<Default onClose={onClose} />)

    await user.click(await screen.findByText("Sidebar Content"))

    expect(onClose).not.toHaveBeenCalled()
  })

  test("閉じている状態では領域外クリック用の backdrop を表示しない", async () => {
    const onClose = vi.fn()
    render(<Closed onClose={onClose} />)

    expect(screen.queryByTestId("sidebar-backdrop")).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  test("ユーザー向けのログアウト表示で、成功時にサイドバーを閉じる", async () => {
    const onClose = vi.fn()
    const queryClient = createTestQueryClient()
    queryClient.setQueryData(["private-data"], { owner: "user-a" })
    const { user } = render(<Default onClose={onClose} />, { queryClient })

    expect(screen.queryByText(/Supabase|verification/)).not.toBeInTheDocument()
    const logoutButton = await screen.findByRole("button", { name: "Log out" })
    expect(logoutButton).toHaveAttribute("data-accent-color", "gray")

    await user.click(logoutButton)

    expect(mockSignOut).toHaveBeenCalledTimes(1)
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" })
    expect(queryClient.getQueryData(["private-data"])).toBeUndefined()
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  test("ログアウトに失敗した場合はエラーを表示し、同じ操作から再試行できる", async () => {
    const error = new Error("failed to sign out")
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const onClose = vi.fn()
    mockSignOut.mockResolvedValueOnce({ error })
    const { user } = render(<Default onClose={onClose} />)

    await user.click(await screen.findByRole("button", { name: "Log out" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not log out. Please try again.",
    )
    expect(onClose).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Log out" }))

    expect(mockSignOut).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
