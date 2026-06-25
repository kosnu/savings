import type { Session } from "@supabase/supabase-js"
import { renderHook } from "@testing-library/react"
import type { PropsWithChildren } from "react"
import { beforeEach, describe, expect, test, vi } from "vite-plus/test"

import { act, waitFor } from "../../test/test-utils"
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
const { mockCaptureSupabaseSessionError, mockEnsureAuthenticatedUser } = vi.hoisted(() => ({
  mockCaptureSupabaseSessionError: vi.fn(),
  mockEnsureAuthenticatedUser: vi.fn(),
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

function renderSessionHook() {
  return renderHook(() => useSupabaseSession(), {
    wrapper: ({ children }: PropsWithChildren) => (
      <SupabaseSessionProvider>{children}</SupabaseSessionProvider>
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

describe("SupabaseSessionProvider", () => {
  beforeEach(() => {
    mockGetSession.mockReset()
    mockGetUser.mockReset()
    mockOnAuthStateChange.mockClear()
    mockSignOut.mockReset()
    mockUnsubscribe.mockClear()
    mockCaptureSupabaseSessionError.mockReset()
    mockEnsureAuthenticatedUser.mockReset()
    mockEnsureAuthenticatedUser.mockResolvedValue(undefined)
    mockGetUser.mockResolvedValue({ data: { user: createSession().user }, error: null })
    mockOnAuthStateChange.mockImplementation(() => ({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    }))
  })

  test("getSession が reject した場合は unauthenticated にフォールバックする", async () => {
    mockGetSession.mockRejectedValueOnce(new Error("network error"))

    const { result } = renderSessionHook()

    expectSession(result, "loading", null)

    await waitFor(() => {
      expectSession(result, "unauthenticated", null)
    })

    expect(mockCaptureSupabaseSessionError).toHaveBeenCalledWith(expect.any(Error))
  })

  test("getSession が認証済みの場合はユーザーを作成済みにしてから authenticated にする", async () => {
    const ensureDeferred = createDeferred<void>()
    mockEnsureAuthenticatedUser.mockReturnValueOnce(ensureDeferred.promise)
    mockGetSession.mockResolvedValueOnce({ data: { session: createSession() }, error: null })

    const { result } = renderSessionHook()

    await waitFor(() => {
      expect(mockEnsureAuthenticatedUser).toHaveBeenCalledWith()
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
  })

  test("unmount後にgetSessionが解決してもユーザー作成を実行しない", async () => {
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

  test("ユーザー作成に失敗した場合は unauthenticated にフォールバックする", async () => {
    const error = new Error("failed to ensure user")
    mockEnsureAuthenticatedUser.mockRejectedValueOnce(error)
    mockGetSession.mockResolvedValueOnce({ data: { session: createSession() }, error: null })

    const { result } = renderSessionHook()

    await waitFor(() => {
      expectSession(result, "unauthenticated", null)
    })

    expect(mockCaptureSupabaseSessionError).toHaveBeenCalledWith(error)
    expect(mockSignOut).toHaveBeenCalledWith()
  })

  test("保存済みsessionがAuth側で無効な場合はユーザー作成を実行せずサインアウトする", async () => {
    const error = new Error("user not found")
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error })
    mockGetSession.mockResolvedValueOnce({ data: { session: createSession() }, error: null })

    const { result } = renderSessionHook()

    await waitFor(() => {
      expectSession(result, "unauthenticated", null)
    })

    expect(mockEnsureAuthenticatedUser).not.toHaveBeenCalled()
    expect(mockSignOut).toHaveBeenCalledWith()
    expect(mockCaptureSupabaseSessionError).toHaveBeenCalledWith(error)
  })

  test("認証購読でサインアウト済みなら遅れて返った getSession の古いsessionを破棄する", async () => {
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
      expectSession(result, "unauthenticated", null)
    })

    await act(async () => {
      getSessionDeferred.resolve({ data: { session: createSession() }, error: null })
      await getSessionDeferred.promise
    })

    expectSession(result, "unauthenticated", null)
    expect(mockEnsureAuthenticatedUser).not.toHaveBeenCalled()
  })

  test("認証済み状態から同じユーザーのsession更新中は既存sessionを維持する", async () => {
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

  test("認証済み状態から同じユーザーのsession更新に失敗しても既存sessionを維持する", async () => {
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
  })

  test("認証済み状態から新しいsessionのユーザー作成に失敗した場合は旧sessionを残さない", async () => {
    const ensureDeferred = createDeferred<void>()
    mockGetSession.mockResolvedValueOnce({
      data: { session: createSession("old-user") },
      error: null,
    })
    const emitAuthStateChange = captureAuthCallback()

    const { result } = renderSessionHook()

    await waitFor(() => {
      expectSession(result, "authenticated", "old-user")
    })

    const error = new Error("failed to ensure new user")
    mockEnsureAuthenticatedUser.mockReturnValueOnce(ensureDeferred.promise)

    act(() => {
      emitAuthStateChange("SIGNED_IN", createSession("new-user"))
    })

    expectSession(result, "loading", null)

    await act(async () => {
      ensureDeferred.reject(error)
      await ensureDeferred.promise.catch(() => undefined)
    })

    await waitFor(() => {
      expectSession(result, "unauthenticated", null)
    })

    expect(mockCaptureSupabaseSessionError).toHaveBeenCalledWith(error)
  })

  test("認証購読で新sessionのensure中なら getSession の reject で未認証に戻さない", async () => {
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
      expect(mockEnsureAuthenticatedUser).toHaveBeenCalledWith()
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
})
