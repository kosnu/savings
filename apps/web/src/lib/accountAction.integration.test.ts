import { http, HttpResponse } from "msw"
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test"

import {
  createAccountDeletionHandlers,
  deletionAuthUserId,
  deletionRequestId,
  deletionTimes,
} from "../test/msw/handlers/accountDeletion"
import { server } from "../test/msw/server"
import { supabaseTestClient } from "../test/utils/createSupabaseTestClient"
import { completeAccountAction, consumeExplicitLogin, markExplicitLogin } from "./accountAction"
import { createDeletionReceipt, readDeletionReceipt } from "./accountDeletion"

vi.mock("./supabase", () => ({ getSupabaseClient: () => supabaseTestClient }))

const originalId = "20870000-0000-4000-8000-000000000010"
const temporaryKey = "burneto-account-action-session"
const markerKey = "burneto-account-action"
let oauthIdentity = deletionAuthUserId
const logoutCalls: { token: string | null; scope: string | null }[] = []

function token(id: string) {
  return `${btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${btoa(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600, aud: "authenticated", role: "authenticated" }))}.test`
}
function user(id: string) {
  return {
    id,
    email: `${id}@example.com`,
    app_metadata: { provider: "google" },
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00Z",
  }
}
function session(id: string) {
  return {
    access_token: token(id),
    refresh_token: `refresh-${id}`,
    expires_in: 3600,
    token_type: "bearer",
    user: user(id),
  }
}
function marker(authUserId?: string, age = 0) {
  sessionStorage.setItem(markerKey, JSON.stringify({ authUserId, startedAt: Date.now() - age }))
  sessionStorage.setItem(`${temporaryKey}-code-verifier`, JSON.stringify("synthetic-code-verifier"))
}

beforeEach(async () => {
  sessionStorage.clear()
  localStorage.clear()
  logoutCalls.length = 0
  oauthIdentity = deletionAuthUserId
  window.history.replaceState(null, "", "/auth/account-action?code=synthetic-code")
  server.use(
    http.get("*/auth/v1/user", ({ request }) =>
      HttpResponse.json(
        user(
          request.headers.get("authorization") === `Bearer ${token(originalId)}`
            ? originalId
            : oauthIdentity,
        ),
      ),
    ),
    http.post("*/auth/v1/token", () => HttpResponse.json(session(oauthIdentity))),
    http.post("*/auth/v1/logout", ({ request }) => {
      logoutCalls.push({
        token: request.headers.get("authorization"),
        scope: new URL(request.url).searchParams.get("scope"),
      })
      return new HttpResponse(null, { status: 204 })
    }),
  )
  await supabaseTestClient.auth.setSession(session(originalId))
})
afterEach(() => {
  window.history.replaceState(null, "", "/")
  sessionStorage.clear()
  localStorage.clear()
})

test.each(["missing", "expired", "future"])(
  "marker %s のcallbackは通常sessionと認証同期へ渡さない",
  async (kind) => {
    if (kind !== "missing") marker(originalId, kind === "expired" ? 300_000 : -1000)
    const exchange = vi.fn()
    server.use(
      http.post("*/auth/v1/token", () => {
        exchange()
        return HttpResponse.json(session(originalId))
      }),
    )
    await expect(completeAccountAction()).rejects.toThrow()
    expect(exchange).not.toHaveBeenCalled()
    expect((await supabaseTestClient.auth.getSession()).data.session?.user.id).toBe(originalId)
    expect(sessionStorage.getItem(markerKey)).toBeNull()
    expect(window.location.search).toBe("")
  },
)

test("別identityのcallbackは一時sessionだけlocal scopeで終了する", async () => {
  marker(originalId)
  const sync = vi.fn()
  server.use(
    http.post("*/rest/v1/rpc/ensure_authenticated_user", () => {
      sync()
      return new HttpResponse(null, { status: 204 })
    }),
  )
  await expect(completeAccountAction()).rejects.toThrow("identity mismatch")
  expect(logoutCalls).toEqual([{ token: `Bearer ${token(deletionAuthUserId)}`, scope: "local" }])
  expect((await supabaseTestClient.auth.getSession()).data.session?.user.id).toBe(originalId)
  expect(sessionStorage.getItem(temporaryKey)).toBeNull()
  expect(sync).not.toHaveBeenCalled()
})

test("同一identityでも状態取得が失敗したら通常sessionを置換しない", async () => {
  oauthIdentity = originalId
  marker(originalId)
  server.use(
    http.post("*/rest/v1/rpc/get_my_account_deletion_state", () =>
      HttpResponse.json({ message: "State unavailable" }, { status: 500 }),
    ),
  )
  const previous = (await supabaseTestClient.auth.getSession()).data.session
  await expect(completeAccountAction()).rejects.toBeDefined()
  expect((await supabaseTestClient.auth.getSession()).data.session).toEqual(previous)
  expect(logoutCalls.every((call) => call.scope === "local")).toBe(true)
})

test("別端末の復帰は保存receiptなしでも本人照会のrequest_idを使う", async () => {
  const unrelated = createDeletionReceipt(originalId)
  marker()
  let current = "pending"
  const ids: string[] = []
  server.use(
    http.post("*/rest/v1/rpc/get_my_account_deletion_state", () =>
      HttpResponse.json(
        current === "pending"
          ? {
              status: "pending",
              request_id: deletionRequestId,
              can_reactivate: true,
              ...deletionTimes,
            }
          : { status: "active" },
      ),
    ),
    http.post("*/rest/v1/rpc/reactivate_my_account", async ({ request }) => {
      const body = (await request.json()) as { request_id: string }
      ids.push(body.request_id)
      current = "active"
      return HttpResponse.json({ status: "cancelled", ...deletionTimes })
    }),
  )
  expect(await completeAccountAction()).toBe("reactivate")
  expect(ids).toEqual([deletionRequestId])
  expect(readDeletionReceipt()).toEqual(unrelated)
  expect((await supabaseTestClient.auth.getSession()).data.session?.user.id).toBe(
    deletionAuthUserId,
  )
})

test("期限後のGoogle成功を復帰や新規登録へ渡さない", async () => {
  marker()
  server.use(
    ...createAccountDeletionHandlers({
      state: {
        status: "pending",
        request_id: deletionRequestId,
        can_reactivate: false,
        ...deletionTimes,
      },
    }),
  )
  await expect(completeAccountAction()).rejects.toThrow("cannot be reactivated")
  expect((await supabaseTestClient.auth.getSession()).data.session?.user.id).toBe(originalId)
  expect(logoutCalls.every((call) => call.scope === "local")).toBe(true)
})

test("通常ログインmarkerは明示callbackで一度だけ消費する", () => {
  window.history.replaceState(null, "", "/auth")
  markExplicitLogin()
  expect(consumeExplicitLogin()).toBe(true)
  expect(consumeExplicitLogin()).toBe(false)
  markExplicitLogin()
  window.history.replaceState(null, "", "/payments")
  expect(consumeExplicitLogin()).toBe(false)
})

test("未着のreceiptがある本人の新ログインは同じ受付の再確認へ進み、予約や取消を実行しない", async () => {
  const receipt = createDeletionReceipt(deletionAuthUserId)
  marker(deletionAuthUserId)
  const mutate = vi.fn()
  server.use(
    ...createAccountDeletionHandlers(),
    http.post("*/rest/v1/rpc/reactivate_my_account", () => {
      mutate()
      return HttpResponse.json({})
    }),
    http.post("*/rest/v1/rpc/request_account_deletion", () => {
      mutate()
      return HttpResponse.json({})
    }),
  )
  expect(await completeAccountAction()).toBe("retry")
  expect(readDeletionReceipt()).toEqual(receipt)
  expect(mutate).not.toHaveBeenCalled()
})
