import { type AuthChangeEvent, createClient, type SupabaseClient } from "@supabase/supabase-js"
import { QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import { afterEach, expect, test, vi } from "vite-plus/test"

import { Router } from "../../app/Router"
import { deletionReceiptKey, type MyDeletionState } from "../../lib/accountDeletion"
import { completeExplicitLogin, getLoginAuth, startExplicitLogin } from "../../lib/explicitLogin"
import { mockSession } from "../../test/data/supabaseSession"
import { deletionRequestId } from "../../test/msw/handlers/accountDeletion"
import { server } from "../../test/msw/server"
import { act, createTestQueryClient, render, screen, waitFor } from "../../test/test-utils"
import { SnackbarProvider } from "../snackbar/SnackbarProvider"
import { ThemeProvider } from "../theme/ThemeProvider"
import { SupabaseSessionProvider } from "./SupabaseSessionProvider"

const client = vi.hoisted(() => ({ current: null as SupabaseClient | null }))
vi.mock("../../lib/supabase", () => ({ getSupabaseClient: () => client.current }))
vi.mock("../../lib/sentry", () => ({ captureSupabaseSessionError: vi.fn() }))
vi.mock("../../app/routes", () => ({
  router: { invalidate: async () => undefined, navigate: async () => undefined },
}))
vi.mock("@tanstack/react-router", () => ({
  RouterProvider: ({ context }: { context: { authStatus: string } }) => (
    <main>{context.authStatus === "authenticated" ? "Authenticated content" : "Public home"}</main>
  ),
  useRouterState: () => "/",
}))

// SDKのsession保存・更新・通知とProvider、復帰UIを接続し、通信応答だけを置換する。
// 非同期の期限切れと応答順を制御するため、Storyの表示状態ではなく実SDKを起点にする。
function setup({
  expireDuringRequest = false,
  invalidSession = false,
  deletion,
  expiredAtStartup = false,
  withoutSession = false,
}: {
  expireDuringRequest?: boolean
  invalidSession?: boolean
  deletion?: MyDeletionState
  expiredAtStartup?: boolean
  withoutSession?: boolean
} = {}) {
  const storageKey = `session-recovery-${crypto.randomUUID()}`
  let now = Date.now()
  const startingTime = now
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")
  const connection = {
    offline: !invalidSession && !deletion,
    requests: [] as string[],
    user: mockSession().user,
    deletion: deletion ?? { status: "active" as const },
  }
  const session = (expiresIn = 3600) =>
    mockSession({
      user: connection.user,
      access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: connection.user.id, exp: Math.floor(now / 1000) + expiresIn })}.dGVzdA`,
      expires_at: Math.floor(now / 1000) + expiresIn,
    })
  const verifiers = new Map<string, string>()
  const login = async () => {
    const auth = getLoginAuth()
    const signIn = auth.signInWithOAuth.bind(auth)
    const oauth = vi
      .spyOn(auth, "signInWithOAuth")
      .mockImplementation(async (args) =>
        signIn({ ...args, options: { ...args.options, skipBrowserRedirect: true } }),
      )
    try {
      await startExplicitLogin()
    } finally {
      oauth.mockRestore()
    }
    const code = crypto.randomUUID()
    const verifier = sessionStorage.getItem("burneto-login-callback-code-verifier")
    if (!verifier) throw new Error("Missing PKCE verifier")
    verifiers.set(code, JSON.parse(verifier))
    return code
  }
  server.use(
    http.post("*/auth/v1/token", async ({ request }) => {
      const { auth_code, code_verifier } = (await request.json()) as {
        auth_code: string
        code_verifier: string
      }
      if (!verifiers.has(auth_code) || verifiers.get(auth_code) !== code_verifier)
        return HttpResponse.json({ message: "Code no longer valid" }, { status: 400 })
      verifiers.delete(auth_code)
      return HttpResponse.json(session())
    }),
    http.get("*/auth/v1/user", () => HttpResponse.json(session().user)),
    http.post("*/auth/v1/logout", () => new HttpResponse(null, { status: 204 })),
  )
  const savedSession = session(expiredAtStartup ? -60 : 3600)
  const storage = new Map(withoutSession ? [] : [[storageKey, JSON.stringify(savedSession)]])
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
        if (path.endsWith("/logout")) return new Response(null, { status: 204 })
        if (path.endsWith("/rpc/get_my_account_deletion_state"))
          return Response.json(connection.deletion)
        if (
          path.endsWith("/rpc/reactivate_my_account") &&
          connection.deletion.status === "pending"
        ) {
          const pendingDeletion = connection.deletion
          connection.deletion = { status: "active" }
          return Response.json({ ...pendingDeletion, status: "cancelled" })
        }
        if (path.endsWith("/rpc/ensure_authenticated_user"))
          return new Response(null, { status: 204 })
        if (path.endsWith("/users")) return Response.json([{ language: "en" }])
        throw new Error(`Unexpected synthetic request: ${path}`)
      },
    },
  })
  const events: { event: AuthChangeEvent; hasSession: boolean }[] = []
  const {
    data: { subscription },
  } = client.current.auth.onAuthStateChange((event, notifiedSession) => {
    events.push({ event, hasSession: notifiedSession !== null })
  })
  const mountProvider = () =>
    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <SupabaseSessionProvider>
          <ThemeProvider>
            <SnackbarProvider>
              <Router />
            </SnackbarProvider>
          </ThemeProvider>
        </SupabaseSessionProvider>
      </QueryClientProvider>,
      { withProviders: false },
    )
  const rendered = mountProvider()
  return {
    ...rendered,
    mountProvider,
    auth: client.current.auth,
    login,
    connection,
    storage,
    storageKey,
    events,
    unmount: () => {
      rendered.unmount()
      subscription.unsubscribe()
    },
    reconnect: () => {
      connection.offline = false
      // SDKが更新失敗を保持するcooldown後の、復旧した接続での再試行。
      now += 61000
    },
  }
}

afterEach(async () => {
  await client.current?.auth.stopAutoRefresh()
  sessionStorage.clear()
  window.history.replaceState(null, "", "/")
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

test.each(["retry", "automatic"])(
  "起動時期限切れの更新失敗でも説明を残し、通信復旧後に%sで認証へ戻る",
  async (recovery) => {
    const p = setup({ expiredAtStartup: true })
    await waitFor(() =>
      expect(p.events).toContainEqual({ event: "INITIAL_SESSION", hasSession: false }),
    )
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Check your connection and try again.",
    )
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled()
    expect(screen.queryByText("Public home")).not.toBeInTheDocument()
    expect(p.storage.has(p.storageKey)).toBe(true)
    expect(p.connection.requests).toContain("/auth/v1/token")
    expect(p.connection.requests.some((path) => path.endsWith("/logout"))).toBe(false)
    p.reconnect()
    if (recovery === "retry") {
      await p.user.click(screen.getByRole("button", { name: "Try again" }))
    } else {
      // 前景への復帰によるSDK自身の更新を通し、Providerのretryは呼ばない。
      vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible")
      act(() => window.dispatchEvent(new Event("visibilitychange")))
    }
    expect(await screen.findByText("Authenticated content")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(p.events).toContainEqual({ event: "TOKEN_REFRESHED", hasSession: true })
    expect(p.connection.requests).toContain("/rest/v1/rpc/ensure_authenticated_user")
    expect(p.connection.requests).toContain("/rest/v1/users")
    p.unmount()
  },
)

test("保存済みsessionのない正常起動はエラーを表示せず未ログインになる", async () => {
  const p = setup({ withoutSession: true })
  expect(await screen.findByText("Public home")).toBeInTheDocument()
  await waitFor(() =>
    expect(p.events).toContainEqual({ event: "INITIAL_SESSION", hasSession: false }),
  )
  expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  expect(p.connection.requests).toEqual([])
  p.unmount()
})

test.each([true, false])(
  "旧受付の保存領域が拒否されても通常起動する（未ログイン=%s）",
  async (withoutSession) => {
    const read = localStorage.getItem.bind(localStorage)
    const remove = localStorage.removeItem.bind(localStorage)
    const reads = vi.spyOn(localStorage, "getItem").mockImplementation((key) => {
      if (key === deletionReceiptKey) throw new DOMException("Storage denied", "SecurityError")
      return read(key)
    })
    vi.spyOn(localStorage, "removeItem").mockImplementation((key) => {
      if (key === deletionReceiptKey) throw new DOMException("Storage denied", "SecurityError")
      remove(key)
    })
    const p = setup({ withoutSession, deletion: { status: "active" } })
    expect(
      await screen.findByText(withoutSession ? "Public home" : "Authenticated content"),
    ).toBeVisible()
    expect(reads).not.toHaveBeenCalledWith(deletionReceiptKey)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    p.unmount()
  },
)

test("無効な認証情報は認証済み画面へ進めず、再認証の理由とログイン操作を表示する", async () => {
  const p = setup({ invalidSession: true })
  expect(await screen.findByRole("alert")).toHaveTextContent("Please sign in again.")
  expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument()
  expect(screen.queryByText("Authenticated content")).not.toBeInTheDocument()
  expect(p.connection.requests).not.toContain("/rest/v1/rpc/ensure_authenticated_user")
  p.unmount()
})

test.each(["本人・期限内", "本人・期限後", "別人"])(
  "停止を検出した端末は自動ログアウトしてトップへ戻り、通常ログインから再判定する（%s）",
  async (scenario) => {
    const canReturn = scenario !== "本人・期限後"
    const deadline = Date.now() + (canReturn ? 1 : -1) * 3_600_000
    const p = setup({
      deletion: {
        status: "pending",
        request_id: deletionRequestId,
        can_reactivate: canReturn,
        delete_after: new Date(deadline).toISOString(),
        purge_after: new Date(deadline + 86_400_000).toISOString(),
      },
    })
    expect(await screen.findByText("Public home")).toBeInTheDocument()
    expect(p.storage.has(p.storageKey)).toBe(false)
    expect(p.connection.requests).toContain("/auth/v1/logout")
    expect(p.connection.requests).not.toContain("/rest/v1/rpc/ensure_authenticated_user")

    if (scenario === "別人") {
      p.connection.user = { ...p.connection.user, id: "other-user" }
      p.connection.deletion = { status: "active" }
    }
    const code = await p.login()
    p.unmount()
    window.history.replaceState(null, "", `/auth?code=${code}`)
    const callback = p.mountProvider()
    if (scenario === "本人・期限後") {
      expect(await screen.findByText("Public home")).toBeInTheDocument()
      expect(window.location.search).toBe("?error=login_failed")
      expect(p.storage.has(p.storageKey)).toBe(false)
    } else {
      expect(await screen.findByText("Authenticated content")).toBeInTheDocument()
    }
    expect(
      p.connection.requests.filter((path) => path.endsWith("/rpc/reactivate_my_account")),
    ).toHaveLength(canReturn && scenario !== "別人" ? 1 : 0)
    callback.unmount()
  },
)

test.each(["markerなし", "marker期限後", "以前のcallback", "認証エラー", "予約期限後"])(
  "%sの戻りは元の通常sessionを置換せず、認証情報をURLに残さない",
  async (scenario) => {
    const p = setup({ deletion: { status: "active" } })
    expect(await screen.findByText("Authenticated content")).toBeInTheDocument()
    p.unmount()
    const original = (await p.auth.getSession()).data.session
    p.connection.requests.length = 0
    const code = scenario === "markerなし" ? "missing" : await p.login()
    if (scenario === "以前のcallback") await p.login()
    if (scenario === "marker期限後")
      sessionStorage.setItem("burneto-explicit-login", String(Date.now() - 300_000))
    p.connection.user = { ...p.connection.user, id: "other-user" }
    if (scenario === "予約期限後") {
      p.connection.deletion = {
        status: "pending",
        request_id: deletionRequestId,
        can_reactivate: false,
        delete_after: "2026-01-01T06:00:00Z",
        purge_after: "2026-01-01T18:00:00Z",
      }
    }
    const params = new URLSearchParams({ code })
    if (scenario === "認証エラー") {
      params.set("error", "server_error")
      params.set("error_code", "unexpected_failure")
      params.set("error_description", "private provider description")
    }
    window.history.replaceState(null, "", `/auth?${params}`)
    await expect(completeExplicitLogin(p.auth)).resolves.toEqual({ status: "failed" })
    expect((await p.auth.getSession()).data.session).toEqual(original)
    expect(
      Object.keys(sessionStorage).filter((key) => key.startsWith("burneto-login-callback")),
    ).toEqual([])
    expect(window.location.hash).toBe("")
    expect(window.location.search).toBe(
      scenario === "認証エラー"
        ? "?error=login_failed&error_code=unexpected_failure"
        : "?error=login_failed",
    )
    expect(p.connection.requests).not.toContain("/rest/v1/rpc/reactivate_my_account")
    expect(p.connection.requests).not.toContain("/rest/v1/rpc/ensure_authenticated_user")
    expect(p.connection.requests).not.toContain("/auth/v1/logout")
  },
)

test("処理済みcallbackを新しいログイン操作に再利用しない", async () => {
  const p = setup({ deletion: { status: "active" } })
  expect(await screen.findByText("Authenticated content")).toBeInTheDocument()
  p.unmount()
  const first = await p.login()
  window.history.replaceState(null, "", `/auth?code=${first}`)
  await completeExplicitLogin(p.auth)
  expect(window.location.search).toBe("")
  expect(
    Object.keys(sessionStorage).filter((key) => key.startsWith("burneto-login-callback")),
  ).toEqual([])
  const original = (await p.auth.getSession()).data.session
  await p.login()
  p.connection.requests.length = 0
  window.history.replaceState(null, "", `/auth?code=${first}`)
  await completeExplicitLogin(p.auth)
  expect(window.location.search).toBe("?error=login_failed")
  expect((await p.auth.getSession()).data.session).toEqual(original)
  expect(p.connection.requests).not.toContain("/rest/v1/rpc/get_my_account_deletion_state")
})
