import * as Sentry from "@sentry/react"
import { afterEach, expect, test, vi } from "vite-plus/test"

import { captureAuthCallbackError, initSentry } from "./sentry"

const { sendEnvelope, testEnv } = vi.hoisted(() => ({
  sendEnvelope: vi.fn(async (_envelope: unknown) => ({ statusCode: 200 })),
  testEnv: {
    MODE: "production",
    PROD: true,
    SENTRY_DSN: "https://public@sentry.invalid/1",
    SENTRY_ENVIRONMENT: "production",
  },
}))
vi.mock("../config/env", () => ({ env: testEnv }))
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
  Sentry.getIsolationScope().setSession(undefined)
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  sendEnvelope.mockClear()
})

test.each(["production", "development"])(
  "%s の idle/hidden で session envelope を送らずエラー送信は保つ",
  async (mode) => {
    testEnv.MODE = mode
    testEnv.SENTRY_ENVIRONMENT = mode
    // 配信ビルドでプラグインが付与する release を再現し、release 不足による送信抑止を避ける。
    vi.stubGlobal("SENTRY_RELEASE", { id: "synthetic-release" })
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible")
    const idleCallbacks: (() => void)[] = []
    vi.stubGlobal("requestIdleCallback", (callback: () => void) => {
      idleCallbacks.push(callback)
      return 1
    })
    initSentry()
    for (const callback of idleCallbacks) callback()
    visibility.mockReturnValue("hidden")
    window.dispatchEvent(new Event("visibilitychange"))
    await Sentry.flush()
    expect(sendEnvelope).not.toHaveBeenCalled()
    expect(Sentry.getClient()?.getOptions().release).toBe("synthetic-release")
    expect(Sentry.getClient()?.getIntegrationByName("BrowserSession")).toBeUndefined()

    captureAuthCallbackError({ code: "access_denied", description: "synthetic-secret" })
    expect(await Sentry.flush()).toBe(true)
    const items = sendEnvelope.mock.calls.flatMap(
      ([envelope]) => (envelope as [unknown, Array<[{ type: string }, unknown]>])[1],
    )
    expect(items.map(([header]) => header.type)).toEqual(["event"])
    expect(items[0][1]).toMatchObject({
      environment: mode,
      message: "Authentication callback failed",
    })
    expect(JSON.stringify(items)).not.toContain("synthetic-secret")
    expect(Sentry.getClient()?.getIntegrationByName("GlobalHandlers")).toBeDefined()
  },
)
