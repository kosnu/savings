import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { QueryClientProvider } from "@tanstack/react-query"
import { afterEach, expect, test, vi } from "vite-plus/test"

import { Router } from "../../app/Router"
import { mockSession } from "../../test/data/supabaseSession"
import { createTestQueryClient, render, screen } from "../../test/test-utils"
import { SnackbarProvider } from "../snackbar/SnackbarProvider"
import { SupabaseSessionProvider } from "./SupabaseSessionProvider"

const client = vi.hoisted(() => ({ current: null as SupabaseClient | null }))
vi.mock("../../lib/supabase", () => ({ getSupabaseClient: () => client.current }))
vi.mock("../../lib/sentry", () => ({ captureSupabaseSessionError: vi.fn() }))
vi.mock("../../app/routes", () => ({ router: { invalidate: async () => undefined } }))
vi.mock("@tanstack/react-router", () => ({
  RouterProvider: () => <main>Authenticated content</main>,
  useRouterState: () => "/",
}))

// SDKのsession保存・更新・通知とProvider、復帰UIを接続し、通信応答だけを置換する。
// 非同期の期限切れと応答順を制御するため、Storyの表示状態ではなく実SDKを起点にする。
function setup({ expireDuringRequest = false, invalidSession = false } = {}) {
  const storageKey = `session-recovery-${crypto.randomUUID()}`
  let now = Date.now()
  const startingTime = now
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")
  const session = () =>
    mockSession({
      access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "mock-user-id", exp: Math.floor(now / 1000) + 3600 })}.synthetic`,
      expires_at: Math.floor(now / 1000) + 3600,
    })
  const storage = new Map([[storageKey, JSON.stringify(session())]])
  const connection = { offline: !invalidSession, requests: [] as string[] }
  vi.spyOn(Date, "now").mockImplementation(() => now)
  client.current = createClient("https://auth.test.invalid", "synthetic-publishable-key", {
    auth: {
      storageKey,
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => {
          storage.set(key, value)
        },
        removeItem: (key) => {
          storage.delete(key)
        },
      },
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (input) => {
        const path = new URL(input instanceof Request ? input.url : input).pathname
        connection.requests.push(path)
        if (connection.offline) {
          if (expireDuringRequest && path.endsWith("/user")) now = startingTime + 7200000
          // 更新要求の待機でretry予算を使い切った通信失敗を再現する。
          if (path.endsWith("/token")) now += 31000
          throw new TypeError("Failed to fetch")
        }
        if (invalidSession && path.endsWith("/user")) {
          return new Response(
            JSON.stringify({ code: "bad_jwt", message: "Synthetic invalid session" }),
            {
              status: 403,
              headers: {
                "content-type": "application/json",
                "x-supabase-api-version": "2024-01-01",
              },
            },
          )
        }
        if (path.endsWith("/token")) return Response.json(session())
        if (path.endsWith("/user")) return Response.json(session().user)
        if (path.endsWith("/rpc/get_my_account_deletion_state"))
          return Response.json({ status: "active" })
        if (path.endsWith("/rpc/ensure_authenticated_user"))
          return new Response(null, { status: 204 })
        if (path.endsWith("/users")) return Response.json([{ language: "en" }])
        throw new Error(`Unexpected synthetic request: ${path}`)
      },
    },
  })
  const rendered = render(
    <QueryClientProvider client={createTestQueryClient()}>
      <SupabaseSessionProvider>
        <SnackbarProvider>
          <Router />
        </SnackbarProvider>
      </SupabaseSessionProvider>
    </QueryClientProvider>,
    { withProviders: false },
  )
  return {
    ...rendered,
    connection,
    storage,
    storageKey,
    reconnect: () => {
      connection.offline = false
      // SDKが更新失敗を保持するcooldown後の、復旧した接続での再試行。
      now += 61000
    },
  }
}

afterEach(async () => {
  await client.current?.auth.stopAutoRefresh()
  vi.restoreAllMocks()
})

test.each([false, true])(
  "通信失敗と検証中の期限切れ=%sから、再試行で認証とユーザー同期まで復帰する",
  async (expireDuringRequest) => {
    const p = setup({ expireDuringRequest })
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Check your connection and try again.",
    )
    expect(screen.queryByText("Authenticated content")).not.toBeInTheDocument()
    expect(p.storage.has(p.storageKey)).toBe(true)
    expect(p.connection.requests.some((path) => path.endsWith("/logout"))).toBe(false)
    p.reconnect()
    await p.user.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("Authenticated content")).toBeInTheDocument()
    expect(document.activeElement).toContainElement(screen.getByText("Authenticated content"))
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(p.connection.requests).toContain("/rest/v1/rpc/ensure_authenticated_user")
    expect(p.connection.requests).toContain("/rest/v1/users")
    if (expireDuringRequest) expect(p.connection.requests).toContain("/auth/v1/token")
    p.unmount()
  },
)

test("無効な認証情報は認証済み画面へ進めず、再認証の理由とGoogleログインを表示する", async () => {
  const p = setup({ invalidSession: true })
  expect(await screen.findByRole("alert")).toHaveTextContent("Please sign in again.")
  expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument()
  expect(screen.queryByText("Authenticated content")).not.toBeInTheDocument()
  expect(p.connection.requests).not.toContain("/rest/v1/rpc/ensure_authenticated_user")
  p.unmount()
})
