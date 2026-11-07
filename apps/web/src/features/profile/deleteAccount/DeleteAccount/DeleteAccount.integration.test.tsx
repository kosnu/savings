import { createHash, webcrypto } from "node:crypto"

import type { User } from "@supabase/supabase-js"
import { createMemoryHistory, createRouter } from "@tanstack/react-router"
import { http, HttpResponse } from "msw"
import { afterEach, expect, test, vi } from "vite-plus/test"
import * as z from "zod"

import { Provider } from "../../../../app/Provider"
import { Router } from "../../../../app/Router"
import { router } from "../../../../app/routes"
import { deletionReceiptKey, type DeletionReceipt } from "../../../../lib/accountDeletion"
import { getLoginAuth } from "../../../../lib/explicitLogin"
import { getSupabaseClient } from "../../../../lib/supabase"
import { mockSession } from "../../../../test/data/supabaseSession"
import {
  deletionAuthUserId,
  deletionPreview,
  deletionTimes,
} from "../../../../test/msw/handlers/accountDeletion"
import { server } from "../../../../test/msw/server"
import { act, render, screen, waitFor } from "../../../../test/test-utils"

const resultInput = z.object({
  request_id: z.uuid(),
  result_secret: z.string().regex(/^[0-9a-f]{64}$/),
})

function accessToken(authUserId = deletionAuthUserId) {
  const iat = Math.floor(Date.now() / 1000)
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")
  return [
    encode({ alg: "HS256", typ: "JWT" }),
    encode({
      sub: authUserId,
      aud: "authenticated",
      iat,
      exp: iat + 3600,
      session_id: crypto.randomUUID(),
      role: "authenticated",
    }),
    "c3ludGhldGlj",
  ].join(".")
}

// 設定、認証通知、通常トップとOAuthからの再訪を同じ受付で通すため、本番Provider・Routerを使う。
const routing = vi.hoisted(() => ({ current: undefined as typeof router | undefined }))
vi.mock("../../../../app/routes", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../../app/routes")>()
  return {
    get router() {
      return routing.current ?? original.router
    },
  }
})

function renderApp(path: "/settings/account" | "/auth") {
  // 履歴や未完了の画面遷移を前のdocumentと共有しない。ルート定義とガードは本番と同じものを使う。
  routing.current = createRouter({
    ...router.options,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { authStatus: "loading", supabaseSession: null },
  })
  return render(
    <Provider>
      <Router />
    </Provider>,
    { withProviders: false },
  )
}

function allowSignedInUser(user: () => User) {
  server.use(
    http.get("*/auth/v1/user", () => HttpResponse.json(user())),
    http.post(
      "*/rest/v1/rpc/ensure_authenticated_user",
      () => new HttpResponse(null, { status: 204 }),
    ),
    http.get("*/rest/v1/users", ({ request }) =>
      HttpResponse.json(
        new URL(request.url).searchParams.get("select") === "language"
          ? [{ language: "en" }]
          : [{ name: "Test User", email: user().email }],
      ),
    ),
  )
}

afterEach(async () => {
  await getSupabaseClient().auth.stopAutoRefresh()
  window.history.replaceState(null, "", "/")
  sessionStorage.clear()
  routing.current = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

test.each([false, true])(
  "設定での受付からログアウトし、本人の通常ログインで同じ予約を取り消す（応答喪失=%s）",
  async (loseResponse) => {
    vi.stubGlobal("crypto", webcrypto)
    const { auth } = getSupabaseClient()
    const initialToken = accessToken()
    const user = { ...mockSession().user, id: deletionAuthUserId, email: deletionPreview.email }
    let receipt: DeletionReceipt | null = null
    let pending = false
    const callbackToken = accessToken()
    const authCode = crypto.randomUUID()
    let challenge: string | null = null
    const lookup = vi.fn()
    const cancel = vi.fn()
    const logout = vi.fn()
    allowSignedInUser(() => user)
    server.use(
      http.post("*/auth/v1/token", async ({ request }) => {
        const exchange = z
          .object({ auth_code: z.string(), code_verifier: z.string() })
          .parse(await request.json())
        if (
          new URL(request.url).searchParams.get("grant_type") !== "pkce" ||
          exchange.auth_code !== authCode ||
          createHash("sha256").update(exchange.code_verifier).digest("base64url") !== challenge
        )
          return HttpResponse.json({}, { status: 400 })
        return HttpResponse.json(
          mockSession({ user, access_token: callbackToken, refresh_token: "return-login" }),
        )
      }),
      http.post("*/auth/v1/logout", ({ request }) => {
        logout(new URL(request.url).searchParams.get("scope"))
        return new HttpResponse(null, { status: 204 })
      }),
      http.post("*/rest/v1/rpc/get_my_account_deletion_state", () =>
        HttpResponse.json(
          pending && receipt
            ? {
                status: "pending",
                request_id: receipt.requestId,
                can_reactivate: true,
                ...deletionTimes,
              }
            : { status: "active" },
        ),
      ),
      http.post("*/rest/v1/rpc/request_account_deletion", async ({ request }) => {
        const body = resultInput
          .extend({ explanation_version: z.string() })
          .parse(await request.json())
        if (
          request.headers.get("Authorization") !== `Bearer ${initialToken}` ||
          body.explanation_version !== deletionPreview.explanation_version
        )
          return HttpResponse.json({}, { status: 403 })
        receipt = { authUserId: user.id, requestId: body.request_id, secret: body.result_secret }
        pending = true
        return loseResponse
          ? HttpResponse.error()
          : HttpResponse.json({ status: "pending", ...deletionTimes })
      }),
      http.post("*/rest/v1/rpc/get_account_deletion_result", async ({ request }) => {
        const body = resultInput.parse(await request.json())
        lookup(body)
        return HttpResponse.json(
          pending &&
            receipt &&
            body.request_id === receipt.requestId &&
            body.result_secret === receipt.secret
            ? { status: "pending", ...deletionTimes }
            : { status: "not_confirmed" },
        )
      }),
      http.post("*/rest/v1/rpc/reactivate_my_account", async ({ request }) => {
        const body = resultInput.pick({ request_id: true }).parse(await request.json())
        if (
          request.headers.get("Authorization") !== `Bearer ${callbackToken}` ||
          !pending ||
          !receipt ||
          body.request_id !== receipt.requestId
        )
          return HttpResponse.json({}, { status: 403 })
        pending = false
        cancel(body)
        return HttpResponse.json({ status: "cancelled", ...deletionTimes })
      }),
    )
    expect(
      (await auth.setSession({ access_token: initialToken, refresh_token: "first-login" })).error,
    ).toBeNull()
    const view = renderApp("/settings/account")
    await view.user.click(await screen.findByRole("button", { name: "Schedule account deletion" }))
    // 認証が確立した状態で受付情報の保存を拒否し、通常の申請とその場の再照会の双方を通す。
    const deny = () => {
      throw new DOMException("Storage denied", "SecurityError")
    }
    const localWrites = vi.spyOn(localStorage, "setItem").mockImplementation(deny)
    const sessionWrites = vi.spyOn(Storage.prototype, "setItem").mockImplementation(deny)
    await view.user.click(await screen.findByRole("button", { name: "Confirm deletion schedule" }))
    expect(await screen.findByRole("link", { name: "Sign in" })).toBeVisible()
    expect(screen.getByRole("heading", { name: "Burneto", level: 1 })).toBeVisible()
    expect(router.state.location.pathname).toBe("/")
    expect(await screen.findByText("Your account deletion request was accepted.")).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Schedule account deletion" }),
    ).not.toBeInTheDocument()
    expect(logout).toHaveBeenCalledExactlyOnceWith("local")
    expect((await auth.getSession()).data.session).toBeNull()
    expect(localWrites).not.toHaveBeenCalled()
    expect(sessionWrites).not.toHaveBeenCalled()
    localWrites.mockRestore()
    sessionWrites.mockRestore()
    if (!receipt) throw new Error("The deletion request was not accepted")
    const accepted: DeletionReceipt = receipt
    if (loseResponse)
      expect(lookup).toHaveBeenCalledExactlyOnceWith({
        request_id: accepted.requestId,
        result_secret: accepted.secret,
      })
    else expect(lookup).not.toHaveBeenCalled()
    // 外部への画面遷移だけを抑止し、SDKにPKCE用の照合情報と認可URLを生成させる。
    const loginAuth = getLoginAuth()
    const signIn = loginAuth.signInWithOAuth.bind(loginAuth)
    const oauth = vi
      .spyOn(loginAuth, "signInWithOAuth")
      .mockImplementation(async ({ provider, options }) =>
        signIn({ provider, options: { ...options, skipBrowserRedirect: true } }),
      )
    await view.user.click(screen.getByRole("link", { name: "Sign in" }))
    await view.user.click(await screen.findByRole("button", { name: "Sign in" }))
    expect(oauth).toHaveBeenCalledOnce()
    const { data: authorization } = await oauth.mock.results[0].value
    if (!authorization.url) throw new Error("OAuth authorization URL is missing")
    const authorizeUrl = new URL(authorization.url)
    expect(authorizeUrl.searchParams.get("code_challenge_method")).toBe("s256")
    challenge = authorizeUrl.searchParams.get("code_challenge")
    expect(challenge).toBeTruthy()
    const redirectTo = authorizeUrl.searchParams.get("redirect_to")
    if (!redirectTo) throw new Error("OAuth redirect URL is missing")
    const callback = new URL(redirectTo)
    expect(callback.pathname).toBe("/auth")
    callback.searchParams.set("code", authCode)
    view.unmount()
    window.history.replaceState(null, "", callback)
    const returned = renderApp("/auth")
    expect(
      await screen.findByText(
        "Account deletion was cancelled. Your original account can be used again.",
      ),
    ).toBeVisible()
    expect(cancel).toHaveBeenCalledExactlyOnceWith({ request_id: accepted.requestId })
    expect((await auth.getSession()).data.session?.user.id).toBe(user.id)
    await act(async () => {
      await router.navigate({ to: "/settings/account" })
    })
    expect(await screen.findByRole("button", { name: "Schedule account deletion" })).toBeEnabled()
    await waitFor(() => expect(screen.getByText(user.email)).toBeVisible())
    returned.unmount()
  },
)

test.each(["active", "pending", "anonymous"] as const)(
  "受付未確認の画面を終了し、%sで再訪すると通常の認証判定だけを行う",
  async (stateOnReload) => {
    const { auth } = getSupabaseClient()
    const user = { ...mockSession().user, id: deletionAuthUserId, email: deletionPreview.email }
    allowSignedInUser(() => user)
    const lookup = vi.fn()
    const request = vi.fn()
    let reloading = false
    const state = vi.fn()
    server.use(
      http.post("*/rest/v1/rpc/request_account_deletion", async ({ request: req }) => {
        request(resultInput.parse(await req.json()))
        return HttpResponse.error()
      }),
      http.post("*/rest/v1/rpc/get_account_deletion_result", async ({ request: req }) => {
        lookup(await req.json())
        return HttpResponse.json({ status: "not_confirmed" })
      }),
      http.post("*/rest/v1/rpc/get_my_account_deletion_state", () => {
        state()
        return HttpResponse.json(
          reloading && stateOnReload === "pending"
            ? {
                status: "pending",
                request_id: request.mock.calls[0][0].request_id,
                can_reactivate: true,
                ...deletionTimes,
              }
            : { status: "active" },
        )
      }),
    )
    expect(
      (await auth.setSession({ access_token: accessToken(), refresh_token: "first-login" })).error,
    ).toBeNull()
    const view = renderApp("/settings/account")
    await view.user.click(await screen.findByRole("button", { name: "Schedule account deletion" }))
    await view.user.click(await screen.findByRole("button", { name: "Confirm deletion schedule" }))
    expect(await screen.findByRole("button", { name: "Recheck request" })).toBeEnabled()
    expect(request).toHaveBeenCalledOnce()
    const submitted = resultInput.parse(request.mock.calls[0][0])
    expect(lookup).toHaveBeenCalledExactlyOnceWith(submitted)
    view.unmount()
    if (stateOnReload === "anonymous")
      expect((await auth.signOut({ scope: "local" })).error).toBeNull()
    // 旧版の有効な控えを残したブラウザでも、再訪時にその番号を取り出して照会・再送しない。
    localStorage.setItem(
      deletionReceiptKey,
      JSON.stringify({
        authUserId: user.id,
        requestId: submitted.request_id,
        secret: submitted.result_secret,
        createdAt: Date.now(),
      }),
    )
    reloading = true
    state.mockClear()
    const returned = renderApp("/settings/account")
    if (stateOnReload === "active") {
      expect(await screen.findByRole("button", { name: "Schedule account deletion" })).toBeEnabled()
      expect((await auth.getSession()).data.session?.user.id).toBe(user.id)
    } else {
      expect(await screen.findByRole("link", { name: "Sign in" })).toBeVisible()
      expect((await auth.getSession()).data.session).toBeNull()
    }
    expect(state.mock.calls.length > 0).toBe(stateOnReload !== "anonymous")
    expect(localStorage.getItem(deletionReceiptKey)).toBeNull()
    expect(screen.queryByRole("button", { name: "Recheck request" })).not.toBeInTheDocument()
    expect(
      screen.queryByText("Your account deletion request was accepted."),
    ).not.toBeInTheDocument()
    expect(request).toHaveBeenCalledOnce()
    expect(lookup).toHaveBeenCalledOnce()
    returned.unmount()
  },
)

test("Aの照会が遅れてBへ切り替わっても、Bは別の控えで予約し、Aの予約を変更しない", async () => {
  const { auth } = getSupabaseClient()
  const userA = { ...mockSession().user, id: deletionAuthUserId, email: deletionPreview.email }
  const userB = { ...userA, id: crypto.randomUUID(), email: "second@example.com" }
  const tokenA = accessToken(userA.id)
  const tokenB = accessToken(userB.id)
  let currentUser = userA
  allowSignedInUser(() => currentUser)
  const schedules = new Map<string, z.infer<typeof resultInput>>()
  const lookup = vi.fn()
  const logout = vi.fn()
  const reactivation = vi.fn()
  let resolveLookup!: () => void
  const lookupResponse = new Promise<void>((resolve) => {
    resolveLookup = resolve
  })
  server.use(
    http.post("*/rest/v1/rpc/prepare_account_deletion", () =>
      HttpResponse.json({
        ...deletionPreview,
        auth_user_id: currentUser.id,
        email: currentUser.email,
      }),
    ),
    http.post("*/rest/v1/rpc/request_account_deletion", async ({ request }) => {
      const body = resultInput.parse(await request.json())
      const bearer = request.headers.get("authorization")
      if (bearer === `Bearer ${tokenA}` && !schedules.has(userA.id)) {
        schedules.set(userA.id, body)
        return HttpResponse.error()
      }
      if (bearer === `Bearer ${tokenB}` && !schedules.has(userB.id)) {
        schedules.set(userB.id, body)
        return HttpResponse.json({ status: "pending", ...deletionTimes })
      }
      return HttpResponse.json({}, { status: 403 })
    }),
    http.post("*/rest/v1/rpc/get_my_account_deletion_state", () =>
      HttpResponse.json({ status: "active" }),
    ),
    http.post("*/rest/v1/rpc/get_account_deletion_result", async ({ request }) => {
      lookup(await request.json())
      await lookupResponse
      return HttpResponse.json({ status: "pending", ...deletionTimes })
    }),
    http.post("*/rest/v1/rpc/reactivate_my_account", () => {
      reactivation()
      return HttpResponse.json({}, { status: 403 })
    }),
    http.post("*/auth/v1/logout", ({ request }) => {
      logout(request.headers.get("authorization"))
      return new HttpResponse(null, { status: 204 })
    }),
  )
  expect(
    (await auth.setSession({ access_token: tokenA, refresh_token: "first-login" })).error,
  ).toBeNull()
  const view = renderApp("/settings/account")
  await view.user.click(await screen.findByRole("button", { name: "Schedule account deletion" }))
  await view.user.click(await screen.findByRole("button", { name: "Confirm deletion schedule" }))
  await waitFor(() => expect(lookup).toHaveBeenCalledOnce())
  const first = schedules.get(userA.id)
  if (!first) throw new Error("Missing first request")
  currentUser = userB
  await act(async () => {
    expect(
      (await auth.setSession({ access_token: tokenB, refresh_token: "second-login" })).error,
    ).toBeNull()
  })
  expect(await screen.findByText(userB.email)).toBeVisible()
  await act(async () => {
    resolveLookup()
    await lookupResponse
  })
  expect(screen.queryByText("Your account deletion request was accepted.")).not.toBeInTheDocument()
  expect(logout).not.toHaveBeenCalled()
  await view.user.click(await screen.findByRole("button", { name: "Schedule account deletion" }))
  await view.user.click(await screen.findByRole("button", { name: "Confirm deletion schedule" }))
  expect(await screen.findByRole("link", { name: "Sign in" })).toBeVisible()
  const second = schedules.get(userB.id)
  if (!second) throw new Error("Missing second request")
  expect(second.request_id).not.toBe(first.request_id)
  expect(second.result_secret).not.toBe(first.result_secret)
  expect(lookup).toHaveBeenCalledExactlyOnceWith(first)
  expect(schedules.get(userA.id)).toEqual(first)
  expect(logout).toHaveBeenCalledExactlyOnceWith(`Bearer ${tokenB}`)
  expect(reactivation).not.toHaveBeenCalled()
  view.unmount()
})
