import * as Sentry from "@sentry/react"
import { afterEach, expect, test, vi } from "vite-plus/test"

import { captureAuthCallbackError, initSentry } from "./sentry"

const { sendEnvelope } = vi.hoisted(() => ({
  sendEnvelope: vi.fn(async (_envelope: unknown) => ({ statusCode: 200 })),
}))

vi.mock("../config/env", () => ({
  env: {
    MODE: "production",
    SENTRY_DSN: "https://public@example.com/1",
    SENTRY_ENVIRONMENT: "test",
  },
}))

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
  await Sentry.close()
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
  expect(event.request?.url).toContain("view=callback")
  expect(JSON.stringify(event)).not.toContain("secret-code")
  expect(sendEnvelope).toHaveBeenCalled()
})
