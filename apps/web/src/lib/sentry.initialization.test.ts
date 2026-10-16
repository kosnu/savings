import { afterEach, expect, test, vi } from "vite-plus/test"

const { initialize } = vi.hoisted(() => ({ initialize: vi.fn() }))
vi.mock("@sentry/react", () => ({ init: initialize }))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

test.each([
  { mode: "development", build: false, dsn: "https://public@sentry.invalid/1", enabled: false },
  { mode: "production", build: false, dsn: "https://public@sentry.invalid/1", enabled: false },
  { mode: "development", build: true, dsn: "https://public@sentry.invalid/1", enabled: true },
  { mode: "production", build: true, dsn: "https://public@sentry.invalid/1", enabled: true },
  { mode: "development", build: true, dsn: "", enabled: false },
  { mode: "production", build: true, dsn: "", enabled: false },
])("初期化: mode=$mode build=$build DSN=$dsn", async ({ mode, build, dsn, enabled }) => {
  vi.resetModules()
  vi.stubEnv("MODE", mode)
  vi.stubEnv("PROD", build)
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_fixture")
  vi.stubEnv("VITE_SENTRY_DSN", dsn)
  vi.stubEnv("VITE_SENTRY_ENVIRONMENT", mode)
  const { initSentry } = await import("./sentry")
  initSentry()
  expect(initialize).toHaveBeenCalledTimes(enabled ? 1 : 0)
  if (enabled) {
    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn,
        environment: mode,
        sampleRate: 1,
        beforeSend: expect.any(Function),
        beforeBreadcrumb: expect.any(Function),
      }),
    )
  }
})
