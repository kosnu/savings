import type { Session } from "@supabase/supabase-js"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { render, screen, waitFor } from "../../test/test-utils"
import { SupabaseSessionProvider } from "./SupabaseSessionProvider"
import { useSupabaseSession } from "./useSupabaseSession"

const mockGetSession = vi.fn()
const mockOnAuthStateChange = vi.fn()
const mockUnsubscribe = vi.fn()
const { mockCaptureSupabaseSessionError } = vi.hoisted(() => ({
  mockCaptureSupabaseSessionError: vi.fn(),
}))

vi.mock("../../lib/sentry", () => ({
  captureSupabaseSessionError: mockCaptureSupabaseSessionError,
}))

vi.mock("../../lib/supabase", () => ({
  getSupabaseClient: () => ({
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  }),
}))

function createSession(): Session {
  return {
    access_token: "token",
    refresh_token: "refresh-token",
    expires_in: 3600,
    expires_at: 1_700_000_000,
    token_type: "bearer",
    user: {
      id: "user-id",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2024-01-01T00:00:00.000Z",
    },
  }
}

function SessionStateView() {
  const { status } = useSupabaseSession()

  return <div>{status}</div>
}

describe("SupabaseSessionProvider", () => {
  beforeEach(() => {
    mockGetSession.mockReset()
    mockOnAuthStateChange.mockClear()
    mockUnsubscribe.mockClear()
    mockCaptureSupabaseSessionError.mockReset()
    mockOnAuthStateChange.mockImplementation(() => ({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    }))
  })

  test("getSession が reject した場合は unauthenticated にフォールバックする", async () => {
    mockGetSession.mockRejectedValueOnce(new Error("network error"))

    render(
      <SupabaseSessionProvider>
        <SessionStateView />
      </SupabaseSessionProvider>,
      { withProviders: false },
    )

    expect(screen.getByText("loading")).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText("unauthenticated")).toBeInTheDocument()
    })

    expect(mockCaptureSupabaseSessionError).toHaveBeenCalledWith(expect.any(Error))
  })

  test("認証購読でセッション復元済みなら getSession の reject で未認証に戻さない", async () => {
    let rejectGetSession: ((error: Error) => void) | undefined
    mockGetSession.mockImplementationOnce(
      () =>
        new Promise((_, reject: (error: Error) => void) => {
          rejectGetSession = reject
        }),
    )

    mockOnAuthStateChange.mockImplementationOnce(
      (callback: (_event: string, session: Session | null) => void) => {
        callback("INITIAL_SESSION", createSession())

        return {
          data: { subscription: { unsubscribe: mockUnsubscribe } },
        }
      },
    )

    render(
      <SupabaseSessionProvider>
        <SessionStateView />
      </SupabaseSessionProvider>,
      { withProviders: false },
    )

    await waitFor(() => {
      expect(screen.getByText("authenticated")).toBeInTheDocument()
    })

    rejectGetSession?.(new Error("network error"))

    await waitFor(() => {
      expect(screen.getByText("authenticated")).toBeInTheDocument()
    })

    expect(mockCaptureSupabaseSessionError).toHaveBeenCalledWith(expect.any(Error))
  })
})
