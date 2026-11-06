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
import {
  clearDeletionReceipt,
  createDeletionReceipt,
  deletionReceiptKey,
  getDeletionResult,
  readDeletionReceipt,
  requestAccountDeletion,
} from "./accountDeletion"
import { getSupabaseClient } from "./supabase"

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  const session = mockSession()
  session.user.id = deletionAuthUserId
  vi.spyOn(getSupabaseClient().auth, "getSession").mockResolvedValue({
    data: { session },
    error: null,
  })
})

test("送信前に32byteのキーを保存し、reload後も同じ受付番号で照会できる", async () => {
  const receipt = createDeletionReceipt(deletionAuthUserId)
  expect(receipt.secret).toMatch(/^[0-9a-f]{64}$/)
  expect(readDeletionReceipt()).toEqual(receipt)
  expect(() => createDeletionReceipt(deletionAuthUserId)).toThrow()
  server.use(
    ...createAccountDeletionHandlers({
      result: {
        requestId: receipt.requestId,
        secret: receipt.secret,
        result: { status: "pending", ...deletionTimes },
      },
    }),
  )
  expect(await getDeletionResult(receipt.requestId, receipt.secret)).toEqual({
    status: "pending",
    ...deletionTimes,
  })
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

test("30日経過・壊れた端末記録は消し、結果成功に置き換えない", () => {
  const receipt = createDeletionReceipt(deletionAuthUserId)
  localStorage.setItem(
    deletionReceiptKey,
    JSON.stringify({ ...receipt, createdAt: Date.now() - 30 * 86400000 }),
  )
  expect(readDeletionReceipt()).toBeNull()
  expect(localStorage.getItem(deletionReceiptKey)).toBeNull()
  localStorage.setItem(deletionReceiptKey, "invalid json")
  expect(readDeletionReceipt()).toBeNull()
})

test("保存失敗時は予約を始めず、既存キーを再生成しない", () => {
  vi.spyOn(localStorage, "setItem").mockImplementation(() => {
    throw new Error("Storage denied")
  })
  expect(() => createDeletionReceipt(deletionAuthUserId)).toThrow("Storage denied")
})

test("mutation mockは許可対象未指定・番号不一致を成功にしない", async () => {
  const receipt = {
    requestId: deletionRequestId,
    secret: deletionSecret,
    authUserId: deletionAuthUserId,
    createdAt: Date.now(),
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
  clearDeletionReceipt()
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
