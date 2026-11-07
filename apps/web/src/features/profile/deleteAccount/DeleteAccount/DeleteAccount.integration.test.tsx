import { createHash, webcrypto } from "node:crypto"

import { createMemoryHistory } from "@tanstack/react-router"
import { http, HttpResponse } from "msw"
import { afterEach, expect, test, vi } from "vite-plus/test"
import * as z from "zod"

import { Provider } from "../../../../app/Provider"
import { Router } from "../../../../app/Router"
import { router } from "../../../../app/routes"
import { readDeletionReceipt, type DeletionReceipt } from "../../../../lib/accountDeletion"
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

const resultInput = z.object({ request_id: z.uuid(), result_secret: z.string() })

function accessToken() {
  const iat = Math.floor(Date.now() / 1000)
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")
  return [
    encode({ alg: "HS256", typ: "JWT" }),
    encode({
      sub: deletionAuthUserId,
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
function renderApp(path: "/settings/account" | "/auth") {
  router.update({ ...router.options, history: createMemoryHistory({ initialEntries: [path] }) })
  return render(
    <Provider>
      <Router />
    </Provider>,
    { withProviders: false },
  )
}

afterEach(async () => {
  await getSupabaseClient().auth.stopAutoRefresh()
  window.history.replaceState(null, "", "/")
  sessionStorage.clear()
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
    server.use(
      http.get("*/auth/v1/user", () => HttpResponse.json(user)),
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
      http.post(
        "*/rest/v1/rpc/ensure_authenticated_user",
        () => new HttpResponse(null, { status: 204 }),
      ),
      http.get("*/rest/v1/users", ({ request }) =>
        HttpResponse.json(
          new URL(request.url).searchParams.get("select") === "language"
            ? [{ language: "en" }]
            : [{ name: "Test User", email: user.email }],
        ),
      ),
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
        const saved = readDeletionReceipt()
        const body = resultInput
          .extend({ explanation_version: z.string() })
          .parse(await request.json())
        if (
          !saved ||
          saved.authUserId !== user.id ||
          request.headers.get("Authorization") !== `Bearer ${initialToken}` ||
          body.request_id !== saved.requestId ||
          body.result_secret !== saved.secret ||
          body.explanation_version !== deletionPreview.explanation_version
        )
          return HttpResponse.json({}, { status: 403 })
        receipt = saved
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
    expect(readDeletionReceipt()).toBeNull()
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
