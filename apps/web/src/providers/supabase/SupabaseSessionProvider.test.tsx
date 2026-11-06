import { AuthApiError, type Session } from "@supabase/supabase-js"
import { QueryClientProvider } from "@tanstack/react-query"
import { renderHook } from "@testing-library/react"
import type { PropsWithChildren } from "react"
import { beforeEach, expect, test, vi } from "vite-plus/test"

import { i18next } from "../../i18n"
import { act, createTestQueryClient, waitFor } from "../../test/test-utils"
import { createDeferred } from "../../test/utils/createDeferred"
import {
  type AuthStatus,
  SupabaseSessionProvider,
  type SupabaseSessionState,
} from "./SupabaseSessionProvider"
import { useSupabaseSession } from "./useSupabaseSession"

const mockGetSession = vi.fn()
const mockGetUser = vi.fn()
const mockOnAuthStateChange = vi.fn()
const mockSignOut = vi.fn()
const mockUnsubscribe = vi.fn()
const { mockCaptureSupabaseSessionError, mockEnsureAuthenticatedUser, mockLoadAccountLanguage } =
  vi.hoisted(() => ({
    mockCaptureSupabaseSessionError: vi.fn(),
    mockEnsureAuthenticatedUser: vi.fn(),
    mockLoadAccountLanguage: vi.fn(),
  }))

vi.mock("../../lib/sentry", () => ({
  captureSupabaseSessionError: mockCaptureSupabaseSessionError,
}))

vi.mock("../../lib/supabase", () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: mockGetSession,
      getUser: mockGetUser,
      onAuthStateChange: mockOnAuthStateChange,
      signOut: mockSignOut,
    },
  }),
}))

vi.mock("../../i18n/accountLanguage", () => ({
  loadAccountLanguage: mockLoadAccountLanguage,
  resolveAccountLanguage: (
    accountLanguage: string | null | undefined,
    deviceLanguage: string | undefined,
  ) => {
    if (accountLanguage === "ja") return "ja"
    if (accountLanguage === "en") return "en"
    return deviceLanguage?.startsWith("ja") ? "ja" : "en"
  },
}))

vi.mock("./ensureAuthenticatedUser", () => ({
  ensureAuthenticatedUser: mockEnsureAuthenticatedUser,
}))

function createSession(userId = "user-id", accessToken = `token-${userId}`): Session {
  return {
    access_token: accessToken,
    refresh_token: "refresh-token",
    expires_in: 3600,
    expires_at: 1_700_000_000,
    token_type: "bearer",
    user: {
      id: userId,
      email: `${userId}@example.com`,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2024-01-01T00:00:00.000Z",
    },
  }
}

function renderSessionHook(queryClient = createTestQueryClient()) {
  return renderHook(() => useSupabaseSession(), {
    wrapper: ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>
        <SupabaseSessionProvider>{children}</SupabaseSessionProvider>
      </QueryClientProvider>
    ),
  })
}

function captureAuthCallback() {
  let authCallback: ((_event: string, session: Session | null) => void) | undefined

  mockOnAuthStateChange.mockImplementationOnce(
    (callback: (_event: string, session: Session | null) => void) => {
      authCallback = callback

      return {
        data: { subscription: { unsubscribe: mockUnsubscribe } },
      }
    },
  )

  return (event: string, session: Session | null) => {
    if (!authCallback) throw new Error("Auth callback has not been registered.")

    authCallback(event, session)
  }
}

function expectSession(
  result: { current: SupabaseSessionState },
  status: AuthStatus,
  userId: string | null,
  accessToken?: string,
) {
  expect(result.current.status).toBe(status)
  expect(result.current.session?.user.id ?? null).toBe(userId)

  if (accessToken !== undefined) {
    expect(result.current.session?.access_token ?? null).toBe(accessToken)
  }
}

const testNamePattern = (
  globalThis as typeof globalThis & {
    __vitest_worker__?: { config: { testNamePattern?: RegExp } }
  }
).__vitest_worker__?.config.testNamePattern

function testCase(name: string, callback: () => void | Promise<void>) {
  if (testNamePattern && !testNamePattern.test(name)) {
    return
  }

  test(name, callback)
}

beforeEach(async () => {
  await i18next.changeLanguage("en")
  mockGetSession.mockReset()
  mockGetUser.mockReset()
  mockOnAuthStateChange.mockClear()
  mockSignOut.mockReset()
  mockUnsubscribe.mockClear()
  mockCaptureSupabaseSessionError.mockReset()
  mockEnsureAuthenticatedUser.mockReset()
  mockLoadAccountLanguage.mockReset()
  mockEnsureAuthenticatedUser.mockResolvedValue(undefined)
  mockLoadAccountLanguage.mockResolvedValue(null)
  mockGetUser.mockResolvedValue({ data: { user: createSession().user }, error: null })
  mockSignOut.mockResolvedValue({ error: null })
  mockOnAuthStateChange.mockImplementation(() => ({
    data: { subscription: { unsubscribe: mockUnsubscribe } },
  }))
})

// 初期通知と取得結果の順序を制御するため、StoryではなくProviderの購読境界を使う。
test.each(["before", "after"])(
  "INITIAL_SESSION(null)が取得失敗の%sでもエラーと再試行を維持する",
  async (notificationOrder) => {
    const pending = createDeferred<{ data: { session: null }; error: Error }>()
    mockGetSession.mockReturnValueOnce(pending.promise)
    const emit = captureAuthCallback()
    const { result } = renderSessionHook()
    if (notificationOrder === "before") {
      act(() => emit("INITIAL_SESSION", null))
      expectSession(result, "loading", null)
    }
    await act(async () => {
      pending.resolve({ data: { session: null }, error: new TypeError("Failed to fetch") })
      await pending.promise
    })
    await waitFor(() => expectSession(result, "error", null))
    if (notificationOrder === "after") act(() => emit("INITIAL_SESSION", null))
    expectSession(result, "error", null)
    const state = result.current
    if (state.status !== "error") throw new Error("Expected retryable error")
    expect(state.requiresSignIn).toBe(false)
    expect(mockSignOut).not.toHaveBeenCalled()
    mockGetSession.mockResolvedValueOnce({ data: { session: createSession() }, error: null })
    act(() => state.retry())
    await waitFor(() => expectSession(result, "authenticated", "user-id"))
  },
)

test.each(["before", "after"])(
  "INITIAL_SESSION(null)が正常なsessionなし取得の%sでも未ログインになる",
  async (notificationOrder) => {
    const pending = createDeferred<{ data: { session: null }; error: null }>()
    mockGetSession.mockReturnValueOnce(pending.promise)
    const emit = captureAuthCallback()
    const { result } = renderSessionHook()
    if (notificationOrder === "before") act(() => emit("INITIAL_SESSION", null))
    await act(async () => {
      pending.resolve({ data: { session: null }, error: null })
      await pending.promise
    })
    await waitFor(() => expectSession(result, "unauthenticated", null))
    if (notificationOrder === "after") act(() => emit("INITIAL_SESSION", null))
    expectSession(result, "unauthenticated", null)
    expect(mockGetUser).not.toHaveBeenCalled()
    expect(mockCaptureSupabaseSessionError).not.toHaveBeenCalled()
  },
)

testCase("getSession が reject した場合は 再試行できるエラーにする", async () => {
  mockGetSession.mockRejectedValueOnce(new Error("network error"))

  const { result } = renderSessionHook()

  expectSession(result, "loading", null)

  await waitFor(() => {
    expectSession(result, "error", null)
  })

  expect(mockCaptureSupabaseSessionError).toHaveBeenCalledWith(expect.any(Error))
})

testCase(
  "getSession が認証済みの場合はユーザーを作成済みにしてから authenticated にする",
  async () => {
    const ensureDeferred = createDeferred<void>()
    const session = createSession()
    session.user.user_metadata = { name: "  Initial User  " }
    mockEnsureAuthenticatedUser.mockReturnValueOnce(ensureDeferred.promise)
    mockGetSession.mockResolvedValueOnce({ data: { session }, error: null })

    const { result } = renderSessionHook()

    await waitFor(() => {
      expect(mockEnsureAuthenticatedUser).toHaveBeenCalledWith("Initial User")
    })
    expect(mockGetUser).toHaveBeenCalledWith()
    expectSession(result, "loading", null)

    await act(async () => {
      ensureDeferred.resolve()
      await ensureDeferred.promise
    })

    await waitFor(() => {
      expectSession(result, "authenticated", "user-id")
    })
  },
)

testCase("アカウント言語の解決まで認証済み状態へ遷移しない", async () => {
  const languageDeferred = createDeferred<"en" | "ja">()
  const session = createSession()
  mockLoadAccountLanguage.mockReturnValueOnce(languageDeferred.promise)
  mockGetSession.mockResolvedValueOnce({ data: { session }, error: null })

  const { result } = renderSessionHook()

  await waitFor(() => {
    expect(mockLoadAccountLanguage).toHaveBeenCalledWith("user-id")
  })
  expectSession(result, "loading", null)

  await act(async () => {
    languageDeferred.resolve("ja")
    await languageDeferred.promise
  })

  await waitFor(() => {
    expectSession(result, "authenticated", "user-id")
  })
})

testCase("端末言語と異なるアカウント言語を初回表示前に適用する", async () => {
  await i18next.changeLanguage("en")
  mockLoadAccountLanguage.mockResolvedValueOnce("ja")
  mockGetSession.mockResolvedValueOnce({ data: { session: createSession() }, error: null })

  const { result } = renderSessionHook()

  expectSession(result, "loading", null)
  await waitFor(() => {
    expectSession(result, "authenticated", "user-id")
  })
  expect(i18next.resolvedLanguage).toBe("ja")
})

testCase("unmount後にgetSessionが解決してもユーザー作成を実行しない", async () => {
  const getSessionDeferred = createDeferred<{
    data: { session: Session | null }
    error: Error | null
  }>()
  mockGetSession.mockReturnValueOnce(getSessionDeferred.promise)

  const { unmount } = renderSessionHook()

  unmount()

  await act(async () => {
    getSessionDeferred.resolve({ data: { session: createSession() }, error: null })
    await getSessionDeferred.promise
  })

  expect(mockUnsubscribe).toHaveBeenCalled()
  expect(mockEnsureAuthenticatedUser).not.toHaveBeenCalled()
})

testCase("ユーザー作成に失敗した場合は 再試行できるエラーにする", async () => {
  const error = new Error("failed to ensure user")
  mockEnsureAuthenticatedUser.mockRejectedValueOnce(error)
  mockGetSession.mockResolvedValueOnce({ data: { session: createSession() }, error: null })

  const { result } = renderSessionHook()

  await waitFor(() => {
    expectSession(result, "error", null)
  })

  expect(mockCaptureSupabaseSessionError).toHaveBeenCalledWith(error)
  expect(mockSignOut).not.toHaveBeenCalled()
})

testCase("ユーザー検証失敗後の再試行で認証確認をやり直す", async () => {
  const error = new TypeError("Failed to fetch")
  mockGetUser.mockRejectedValueOnce(error)
  mockGetSession.mockResolvedValue({ data: { session: createSession() }, error: null })
  const { result } = renderSessionHook()
  await waitFor(() => expectSession(result, "error", null))
  const state = result.current
  if (state.status !== "error") throw new Error("Expected retryable error")
  expect(state.requiresSignIn).toBe(false)
  expect(mockSignOut).not.toHaveBeenCalled()
  act(() => state.retry())
  await waitFor(() => expectSession(result, "authenticated", "user-id"))
  expect(mockGetSession).toHaveBeenCalledTimes(2)
  expect(mockEnsureAuthenticatedUser).toHaveBeenCalledTimes(1)
})

testCase("保存済みsessionがAuth側で無効な場合はユーザー作成せず再認証を求める", async () => {
  const error = new AuthApiError("user not found", 403, "user_not_found")
  mockGetUser.mockResolvedValueOnce({ data: { user: null }, error })
  mockGetSession.mockResolvedValueOnce({ data: { session: createSession() }, error: null })

  const { result } = renderSessionHook()

  await waitFor(() => {
    expectSession(result, "error", null)
  })

  expect(mockEnsureAuthenticatedUser).not.toHaveBeenCalled()
  expect(mockSignOut).not.toHaveBeenCalled()
  expect(result.current).toMatchObject({ requiresSignIn: true })
  expect(mockCaptureSupabaseSessionError).toHaveBeenCalledWith(error)
})

testCase(
  "認証購読でサインアウト済みなら遅れて返った getSession の古いsessionを破棄する",
  async () => {
    const getSessionDeferred = createDeferred<{
      data: { session: Session | null }
      error: Error | null
    }>()
    mockGetSession.mockReturnValueOnce(getSessionDeferred.promise)
    const emitAuthStateChange = captureAuthCallback()

    const { result } = renderSessionHook()

    act(() => {
      emitAuthStateChange("SIGNED_OUT", null)
    })

    await waitFor(() => {
      expectSession(result, "error", null)
    })

    await act(async () => {
      getSessionDeferred.resolve({ data: { session: createSession() }, error: null })
      await getSessionDeferred.promise
    })

    expectSession(result, "error", null)
    expect(mockEnsureAuthenticatedUser).not.toHaveBeenCalled()
  },
)

testCase("認証済み状態から同じユーザーのsession更新中は既存sessionを維持する", async () => {
  const ensureDeferred = createDeferred<void>()
  mockGetSession.mockResolvedValueOnce({
    data: { session: createSession("old-user", "old-token") },
    error: null,
  })
  const emitAuthStateChange = captureAuthCallback()

  const { result } = renderSessionHook()

  await waitFor(() => {
    expectSession(result, "authenticated", "old-user", "old-token")
  })

  mockEnsureAuthenticatedUser.mockReturnValueOnce(ensureDeferred.promise)

  act(() => {
    emitAuthStateChange("TOKEN_REFRESHED", createSession("old-user", "refreshed-token"))
  })

  expectSession(result, "authenticated", "old-user", "old-token")

  await act(async () => {
    ensureDeferred.resolve()
    await ensureDeferred.promise
  })

  await waitFor(() => {
    expectSession(result, "authenticated", "old-user", "refreshed-token")
  })
})

testCase("認証済み状態から同じユーザーのsession更新に失敗しても既存sessionを維持する", async () => {
  const ensureDeferred = createDeferred<void>()
  mockGetSession.mockResolvedValueOnce({
    data: { session: createSession("old-user", "old-token") },
    error: null,
  })
  const emitAuthStateChange = captureAuthCallback()

  const queryClient = createTestQueryClient()
  const { result } = renderSessionHook(queryClient)

  await waitFor(() => {
    expectSession(result, "authenticated", "old-user", "old-token")
  })
  queryClient.setQueryData(["private-data"], "old-user-data")

  const error = new Error("failed to ensure refreshed user")
  mockEnsureAuthenticatedUser.mockReturnValueOnce(ensureDeferred.promise)

  act(() => {
    emitAuthStateChange("TOKEN_REFRESHED", createSession("old-user", "refreshed-token"))
  })

  expectSession(result, "authenticated", "old-user", "old-token")

  await act(async () => {
    ensureDeferred.reject(error)
    await ensureDeferred.promise.catch(() => undefined)
  })

  expectSession(result, "authenticated", "old-user", "old-token")
  expect(mockCaptureSupabaseSessionError).toHaveBeenCalledWith(error)
  expect(mockSignOut).not.toHaveBeenCalled()
  expect(queryClient.getQueryData(["private-data"])).toBe("old-user-data")
})

testCase(
  "認証済み状態から新しいsessionのユーザー作成に失敗した場合は旧sessionを残さない",
  async () => {
    const ensureDeferred = createDeferred<void>()
    mockGetSession.mockResolvedValueOnce({
      data: { session: createSession("old-user") },
      error: null,
    })
    const emitAuthStateChange = captureAuthCallback()

    const queryClient = createTestQueryClient()
    const { result } = renderSessionHook(queryClient)

    await waitFor(() => {
      expectSession(result, "authenticated", "old-user")
    })
    queryClient.setQueryData(["private-data"], "old-user-data")

    const error = new Error("failed to ensure new user")
    mockEnsureAuthenticatedUser.mockReturnValueOnce(ensureDeferred.promise)

    act(() => {
      emitAuthStateChange("SIGNED_IN", createSession("new-user"))
    })

    expectSession(result, "loading", null)
    expect(queryClient.getQueryData(["private-data"])).toBeUndefined()

    await act(async () => {
      ensureDeferred.reject(error)
      await ensureDeferred.promise.catch(() => undefined)
    })

    await waitFor(() => {
      expectSession(result, "error", null)
    })

    expect(mockCaptureSupabaseSessionError).toHaveBeenCalledWith(error)
    expect(queryClient.getQueryData(["private-data"])).toBeUndefined()
  },
)

testCase(
  "同じユーザーでも認証情報の無効を確認した場合は旧sessionとキャッシュを破棄する",
  async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: createSession() }, error: null })
    const emitAuthStateChange = captureAuthCallback()
    const queryClient = createTestQueryClient()
    const { result } = renderSessionHook(queryClient)
    await waitFor(() => expectSession(result, "authenticated", "user-id"))
    queryClient.setQueryData(["private-data"], "old-user-data")
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: new AuthApiError("Synthetic invalid session", 401, "bad_jwt"),
    })
    act(() => emitAuthStateChange("TOKEN_REFRESHED", createSession()))
    await waitFor(() => expectSession(result, "error", null))
    expect(result.current).toMatchObject({ requiresSignIn: true })
    expect(queryClient.getQueryData(["private-data"])).toBeUndefined()
    expect(mockSignOut).not.toHaveBeenCalled()
  },
)

testCase("古いsessionのユーザー作成失敗では新しいsessionをサインアウトしない", async () => {
  const oldEnsureDeferred = createDeferred<void>()
  const newEnsureDeferred = createDeferred<void>()
  mockGetSession.mockResolvedValueOnce({ data: { session: null }, error: null })
  mockEnsureAuthenticatedUser
    .mockReturnValueOnce(oldEnsureDeferred.promise)
    .mockReturnValueOnce(newEnsureDeferred.promise)
  const emitAuthStateChange = captureAuthCallback()

  const { result } = renderSessionHook()

  act(() => {
    emitAuthStateChange("SIGNED_IN", createSession("old-user"))
  })

  await waitFor(() => {
    expect(mockEnsureAuthenticatedUser).toHaveBeenCalledTimes(1)
  })

  act(() => {
    emitAuthStateChange("SIGNED_IN", createSession("new-user"))
  })

  await waitFor(() => {
    expect(mockEnsureAuthenticatedUser).toHaveBeenCalledTimes(2)
  })

  const error = new Error("failed to ensure old user")
  await act(async () => {
    oldEnsureDeferred.reject(error)
    await oldEnsureDeferred.promise.catch(() => undefined)
  })

  await act(async () => {
    newEnsureDeferred.resolve()
    await newEnsureDeferred.promise
  })

  await waitFor(() => {
    expectSession(result, "authenticated", "new-user")
  })
  expect(mockSignOut).not.toHaveBeenCalled()
  expect(mockCaptureSupabaseSessionError).toHaveBeenCalledWith(error)
})

testCase("認証購読で新sessionのensure中なら getSession の reject で未認証に戻さない", async () => {
  const getSessionDeferred = createDeferred<{
    data: { session: Session | null }
    error: Error | null
  }>()
  const ensureDeferred = createDeferred<void>()
  mockGetSession.mockReturnValueOnce(getSessionDeferred.promise)
  mockEnsureAuthenticatedUser.mockReturnValueOnce(ensureDeferred.promise)
  const emitAuthStateChange = captureAuthCallback()

  const { result } = renderSessionHook()

  act(() => {
    emitAuthStateChange("INITIAL_SESSION", createSession("event-user"))
  })

  await waitFor(() => {
    expect(mockEnsureAuthenticatedUser).toHaveBeenCalledWith("event-user")
  })
  expectSession(result, "loading", null)

  const error = new Error("network error")
  await act(async () => {
    getSessionDeferred.reject(error)
    await getSessionDeferred.promise.catch(() => undefined)
  })

  expect(mockCaptureSupabaseSessionError).toHaveBeenCalledWith(error)
  expectSession(result, "loading", null)

  await act(async () => {
    ensureDeferred.resolve()
    await ensureDeferred.promise
  })

  await waitFor(() => {
    expectSession(result, "authenticated", "event-user")
  })
})

testCase("getSessionのerror応答から再試行しsessionなしなら未ログインになる", async () => {
  mockGetSession.mockResolvedValueOnce({ data: { session: null }, error: new Error("offline") })
  const { result } = renderSessionHook()
  await waitFor(() => expectSession(result, "error", null))
  const state = result.current
  if (state.status !== "error") throw new Error("Expected retryable error")
  const pending = createDeferred<{ data: { session: Session | null }; error: null }>()
  mockGetSession.mockReturnValueOnce(pending.promise)
  act(() => {
    state.retry()
    state.retry()
  })
  expectSession(result, "loading", null)
  expect(mockGetSession).toHaveBeenCalledTimes(2)
  await act(async () => {
    pending.resolve({ data: { session: null }, error: null })
    await pending.promise
  })
  await waitFor(() => expectSession(result, "unauthenticated", null))
})

testCase("再試行が再び失敗しても再試行でき、成功後の古いretryは無視する", async () => {
  mockGetSession
    .mockRejectedValueOnce(new Error("offline"))
    .mockRejectedValueOnce(new Error("still offline"))
  const { result } = renderSessionHook()
  await waitFor(() => expectSession(result, "error", null))
  const first = result.current
  if (first.status !== "error") throw new Error("Expected error")
  await act(async () => first.retry())
  await waitFor(() => expectSession(result, "error", null))
  const second = result.current
  if (second.status !== "error") throw new Error("Expected error")
  mockGetSession.mockResolvedValueOnce({ data: { session: createSession() }, error: null })
  await act(async () => second.retry())
  await waitFor(() => expectSession(result, "authenticated", "user-id"))
  act(() => first.retry())
  expect(mockGetSession).toHaveBeenCalledTimes(3)
})
