import * as Sentry from "@sentry/react"
import { afterEach, expect, test, vi } from "vite-plus/test"

import { captureAuthCallbackError, initSentry } from "./sentry"

const { sendEnvelope } = vi.hoisted(() => ({
  sendEnvelope: vi.fn(async (_envelope: unknown) => ({ statusCode: 200 })),
}))

const { testEnv } = vi.hoisted(() => ({
  testEnv: {
    MODE: "production",
    PROD: true,
    SENTRY_DSN: "https://public@example.com/1",
    SENTRY_ENVIRONMENT: "test",
  },
}))
vi.mock("../config/env", () => ({ env: testEnv }))

// 実SDKのイベント処理を使い、送信先だけをテスト内に閉じる。
vi.mock("@sentry/react", async (importOriginal) => {
  const sdk = await importOriginal<typeof Sentry>()

  return {
    ...sdk,
    init: (options: Parameters<typeof sdk.init>[0]) =>
      sdk.init({
        ...options,
        transport: () => ({ send: sendEnvelope, flush: async () => true }),
      }),
  }
})

afterEach(async () => {
  testEnv.MODE = "production"
  testEnv.SENTRY_ENVIRONMENT = "test"
  await Sentry.close()
  Sentry.getIsolationScope().clearBreadcrumbs()
  sendEnvelope.mockClear()
  window.history.replaceState({}, "", "/")
})

test("v11でも収集範囲を広げず、認証エラーを送信する", async () => {
  window.history.replaceState({}, "", "/auth?view=callback")
  initSentry()

  const client = Sentry.getClient()
  expect(client).toBeDefined()
  if (!client) {
    throw new Error("Sentry client was not initialized")
  }

  const collection = client.getDataCollectionOptions()
  expect(collection.userInfo).toBe(false)
  expect(collection.cookies).toBe(false)
  expect(collection.httpBodies).toEqual([])
  expect(collection.genAI).toEqual({ inputs: false, outputs: false })
  expect(collection.databaseQueryData).toBe(false)
  expect(collection.queues).toBe(false)
  expect(collection.graphQL).toEqual({ document: false, variables: false })
  expect(collection.httpHeaders.request).toEqual({
    deny: ["forwarded", "-ip", "remote-", "via", "-user"],
  })
  expect(collection.httpHeaders.response).toEqual(collection.httpHeaders.request)
  expect(collection.urlQueryParams).toEqual(collection.httpHeaders.request)

  const beforeSend = vi.fn<(event: Sentry.Event) => void>()
  client.on("beforeSendEvent", beforeSend)

  captureAuthCallbackError({ code: "unexpected_failure", description: "secret-code" })
  expect(await Sentry.flush()).toBe(true)

  expect(beforeSend).toHaveBeenCalledTimes(1)
  const [event] = beforeSend.mock.calls[0]
  expect(event.message).toBe("Authentication callback failed")
  expect(event.level).toBe("error")
  expect(event.environment).toBe("test")
  expect(event.tags).toMatchObject({ feature: "auth" })
  expect(event.contexts?.auth_callback_error).toEqual({ code: "unexpected_failure" })
  expect(event.user?.ip_address).toBeUndefined()
  expect(event.request).toBeUndefined()
  expect(JSON.stringify(event)).not.toContain("secret-code")
  expect(sendEnvelope).toHaveBeenCalled()
})

test("合成の秘密情報を送信せず、分類と配信JSのソース位置を残す", async () => {
  const secret = "synthetic-token-secret"
  const email = "synthetic@example.net"
  const memo = "合成支払いメモ"
  window.history.replaceState({}, "", `/auth?token=${secret}#email=${email}`)
  initSentry()
  const client = Sentry.getClient()
  if (!client) throw new Error("Sentry client was not initialized")
  const sent = vi.fn<(event: Sentry.Event) => void>()
  client.on("beforeSendEvent", sent)
  const asset = `${window.location.origin}/assets/index-abc123.js`
  Sentry.addBreadcrumb({ category: "console", message: `${secret} ${email} ${memo}` })
  Sentry.addBreadcrumb({
    category: "fetch",
    data: { url: `https://example.net/${secret}`, method: "POST", status_code: 503, body: memo },
  })
  Sentry.captureEvent({
    message: `${secret} ${email} ${memo}`,
    user: { email, id: secret },
    request: { url: window.location.href, headers: { Authorization: secret }, data: memo },
    extra: { secret, memo },
    contexts: { payment: { memo }, auth_callback_error: { code: secret } },
    tags: { email },
    fingerprint: [secret],
    transaction: email,
    exception: {
      values: [
        {
          type: "TypeError",
          value: memo,
          mechanism: { type: "onunhandledrejection", handled: false, data: { secret } },
          stacktrace: {
            frames: [
              {
                filename: `${asset}?token=${secret}#${email}`,
                lineno: 42,
                colno: 7,
                function: memo,
                vars: { secret },
                context_line: email,
              },
            ],
          },
        },
      ],
    },
    debug_meta: {
      images: [
        {
          type: "sourcemap",
          code_file: `${asset}?${secret}`,
          debug_id: "12345678-1234-1234-1234-123456789abc",
        },
      ],
    },
  })
  expect(await Sentry.flush()).toBe(true)
  expect(sent).toHaveBeenCalledTimes(1)
  const [event] = sent.mock.calls[0]
  const serialized = JSON.stringify(event)
  for (const value of [secret, email, memo]) expect(serialized).not.toContain(value)
  expect(event.message).toBe("Application error")
  expect(event.exception?.values?.[0]).toMatchObject({
    type: "TypeError",
    value: "[Removed]",
    mechanism: { type: "onunhandledrejection", handled: false },
  })
  expect(event.exception?.values?.[0].stacktrace?.frames?.[0]).toEqual({
    filename: asset,
    lineno: 42,
    colno: 7,
  })
  expect(event.debug_meta?.images?.[0]).toMatchObject({
    code_file: asset,
    debug_id: "12345678-1234-1234-1234-123456789abc",
  })
  expect(event.breadcrumbs).toEqual([
    {
      category: "fetch",
      type: "http",
      timestamp: expect.any(Number),
      data: { method: "POST", status_code: 503 },
    },
  ])
  expect(event.contexts?.auth_callback_error).toEqual({ code: "unknown" })
  expect(JSON.stringify(sendEnvelope.mock.calls[sendEnvelope.mock.calls.length - 1])).not.toContain(
    secret,
  )
})

test("送信先が失敗しても診断の呼び出し元へ例外を伝播しない", async () => {
  sendEnvelope.mockRejectedValueOnce(new Error("Synthetic transport failure"))
  initSentry()
  expect(() => captureAuthCallbackError({ code: "access_denied" })).not.toThrow()
  await Sentry.flush()
})

test("Dev Preview のエラーを production と異なる環境名で送信する", async () => {
  testEnv.MODE = "development"
  testEnv.SENTRY_ENVIRONMENT = "development"
  initSentry()
  const client = Sentry.getClient()
  if (!client) throw new Error("Sentry client was not initialized")
  const sent = vi.fn<(event: Sentry.Event) => void>()
  client.on("beforeSendEvent", sent)
  captureAuthCallbackError({ code: "access_denied", description: "synthetic-secret" })
  expect(await Sentry.flush()).toBe(true)
  expect(sent).toHaveBeenCalledTimes(1)
  const [event] = sent.mock.calls[0]
  expect(event.environment).toBe("development")
  expect(event.contexts?.auth_callback_error).toEqual({ code: "access_denied" })
  expect(JSON.stringify(event)).not.toContain("synthetic-secret")
  expect(sendEnvelope).toHaveBeenCalledTimes(1)
})
