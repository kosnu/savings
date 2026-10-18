import { afterEach, expect, test, vi } from "vite-plus/test"

const { credentials, gitHead, sentryPlugin } = vi.hoisted(() => ({
  credentials: {
    SENTRY_AUTH_TOKEN: "synthetic-upload-token",
    SENTRY_ORG: "fixture-org",
    SENTRY_PROJECT: "fixture-project",
    SENTRY_RELEASE: "different-release",
  },
  gitHead: vi.fn(() => `${"a".repeat(40)}\n`),
  sentryPlugin: vi.fn(() => [{ name: "sentry-fixture" }]),
}))

vi.mock("node:child_process", () => ({ execFileSync: gitHead }))
vi.mock("vite-plus", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vite-plus")>()),
  loadEnv: () => credentials,
  lazyPlugins: (factory: () => unknown) => factory(),
}))
vi.mock("@sentry/vite-plugin", () => ({ sentryVitePlugin: sentryPlugin }))
vi.mock("@cloudflare/vite-plugin", () => ({ cloudflare: () => [{ name: "cloudflare-fixture" }] }))
vi.mock("@vitejs/plugin-react", () => ({ default: () => [] }))
vi.mock("@tanstack/devtools-vite", () => ({ devtools: () => [{ name: "devtools-fixture" }] }))

afterEach(() => {
  credentials.SENTRY_AUTH_TOKEN = "synthetic-upload-token"
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

async function configure(mode: string, command: "build" | "serve") {
  const { default: config } = await import("../../vite.config")
  if (typeof config !== "function") throw new Error("Expected config factory")
  return config({ mode, command, isPreview: false })
}

test.each(["production", "development"])(
  "%s の配信でビルド対象 SHA と source map を対応付ける",
  async (mode) => {
    vi.stubEnv("GITHUB_SHA", "b".repeat(40))
    vi.stubEnv("SENTRY_RELEASE", "different-release")
    const config = await configure(mode, "build")
    expect(config.build?.sourcemap).toBe("hidden")
    expect(sentryPlugin).toHaveBeenCalledExactlyOnceWith({
      telemetry: false,
      authToken: "synthetic-upload-token",
      org: "fixture-org",
      project: "fixture-project",
      release: { name: "a".repeat(40) },
      sourcemaps: {
        assets: ["./.cloudflare/output/v0/workers/default/assets/**"],
        filesToDeleteAfterUpload: [
          "./.cloudflare/output/v0/workers/default/assets/**/*.js.map",
          "./.cloudflare/output/v0/workers/default/assets/**/*.css.map",
        ],
      },
    })
  },
)

test.each(["production", "development"])(
  "%s の local サーバーでは管理 token を使わない",
  async (mode) => {
    const config = await configure(mode, "serve")
    expect(config.build?.sourcemap).toBe(false)
    expect(sentryPlugin).not.toHaveBeenCalled()
    expect(gitHead).not.toHaveBeenCalled()
  },
)

test.each(["production", "development"])(
  "%s の認証なし CI ではアップロードしない",
  async (mode) => {
    credentials.SENTRY_AUTH_TOKEN = ""
    const config = await configure(mode, "build")
    expect(config.build?.sourcemap).toBe(false)
    expect(sentryPlugin).not.toHaveBeenCalled()
    expect(gitHead).not.toHaveBeenCalled()
  },
)

test.each(["production", "development"])(
  "%s の配信で Git HEAD を取得できなければ停止する",
  async (mode) => {
    gitHead.mockImplementationOnce(() => {
      throw new Error("Git HEAD unavailable")
    })
    await expect(configure(mode, "build")).rejects.toThrow("Git HEAD unavailable")
    expect(sentryPlugin).not.toHaveBeenCalled()
  },
)
