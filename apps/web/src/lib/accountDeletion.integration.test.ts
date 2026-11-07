import { http, HttpResponse } from "msw"
import { beforeEach, expect, test, vi } from "vite-plus/test"

import { mockSession } from "../test/data/supabaseSession"
import {
  createAccountDeletionHandlers,
  deletionAuthUserId,
  deletionRequestId,
  deletionSecret,
  deletionTimes,
} from "../test/msw/handlers/accountDeletion"
import { server } from "../test/msw/server"
import { createDeletionReceipt, getDeletionResult, requestAccountDeletion } from "./accountDeletion"
import { getSupabaseClient } from "./supabase"

beforeEach(() => {
  vi.restoreAllMocks()
  const session = mockSession()
  session.user.id = deletionAuthUserId
  vi.spyOn(getSupabaseClient().auth, "getSession").mockResolvedValue({
    data: { session },
    error: null,
  })
})

test("受付用storageの読み書きが拒否されても本人ごとに新しい受付番号とキーを作成する", () => {
  const denied = () => {
    throw new DOMException("Storage denied", "SecurityError")
  }
  for (const storage of [localStorage, Storage.prototype]) {
    vi.spyOn(storage, "getItem").mockImplementation(denied)
    vi.spyOn(storage, "setItem").mockImplementation(denied)
  }
  const first = createDeletionReceipt(deletionAuthUserId)
  const other = createDeletionReceipt("20870000-0000-4000-8000-000000000003")
  expect(first.secret).toMatch(/^[0-9a-f]{64}$/)
  expect(other.secret).toMatch(/^[0-9a-f]{64}$/)
  expect(other.requestId).not.toBe(first.requestId)
  expect(other.secret).not.toBe(first.secret)
})

test("匿名照会には通常のJWTやURL上の確認キーを含めない", async () => {
  let observed: Request | undefined
  server.use(
    http.post("*/rest/v1/rpc/get_account_deletion_result", async ({ request }) => {
      observed = request
      return HttpResponse.json({ status: "not_confirmed" })
    }),
  )
  expect(await getDeletionResult(deletionRequestId, deletionSecret)).toEqual({
    status: "not_confirmed",
  })
  expect(observed).toBeDefined()
  if (!observed) throw new Error("Request missing")
  expect(observed.url).not.toContain(deletionSecret)
  expect(observed.headers.get("authorization")).toBe(`Bearer ${observed.headers.get("apikey")}`)
  expect(await observed.json()).toEqual({
    request_id: deletionRequestId,
    result_secret: deletionSecret,
  })
})

test("mutation mockは許可対象未指定・番号不一致を成功にしない", async () => {
  const receipt = {
    requestId: deletionRequestId,
    secret: deletionSecret,
    authUserId: deletionAuthUserId,
  }
  await expect(requestAccountDeletion(receipt, "2026-11-06")).rejects.toMatchObject({
    message: "Request not allowed",
  })
  server.use(
    ...createAccountDeletionHandlers({
      request: {
        requestId: deletionRequestId,
        secret: deletionSecret,
        explanationVersion: "2026-11-06",
        result: { status: "pending", ...deletionTimes },
      },
    }),
  )
  await expect(
    requestAccountDeletion({ ...receipt, requestId: deletionAuthUserId }, "2026-11-06"),
  ).rejects.toMatchObject({ message: "Request not allowed" })
  expect(await requestAccountDeletion(receipt, "2026-11-06")).toEqual({
    status: "pending",
    ...deletionTimes,
  })
})

test("送信時の別identityを拒否し、照合後に切り替わっても本人のJWTを固定する", async () => {
  const receipt = createDeletionReceipt(deletionAuthUserId)
  const other = mockSession()
  other.user.id = "20870000-0000-4000-8000-000000000003"
  other.access_token = "other-account-token"
  const getSession = vi.spyOn(getSupabaseClient().auth, "getSession")
  getSession.mockResolvedValue({ data: { session: other }, error: null })
  const seen = vi.fn()
  server.use(
    http.post("*/rest/v1/rpc/request_account_deletion", ({ request }) => {
      seen(request.headers.get("authorization"))
      return HttpResponse.json({ status: "pending", ...deletionTimes })
    }),
  )
  await expect(requestAccountDeletion(receipt, "2026-11-06")).rejects.toThrow("identity mismatch")
  expect(seen).not.toHaveBeenCalled()
  const confirmed = mockSession()
  confirmed.user.id = deletionAuthUserId
  confirmed.access_token = "confirmed-account-token"
  getSession.mockResolvedValueOnce({ data: { session: confirmed }, error: null })
  await requestAccountDeletion(receipt, "2026-11-06")
  expect(seen).toHaveBeenCalledWith("Bearer confirmed-account-token")
})
