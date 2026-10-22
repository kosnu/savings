import { afterEach, expect, test, vi } from "vite-plus/test"

const { credentials, sentryPlugin } = vi.hoisted(() => ({
  credentials: {
    SENTRY_AUTH_TOKEN: "synthetic-upload-token",
    SENTRY_ORG: "fixture-org",
    SENTRY_PROJECT: "fixture-project",
  },
  sentryPlugin: vi.fn(() => [{ name: "sentry-fixture" }]),
}))

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
  credentials.SENTRY_ORG = "fixture-org"
  credentials.SENTRY_PROJECT = "fixture-project"
  vi.clearAllMocks()
})

async function configure(mode: string, command: "build" | "serve") {
  const { default: config } = await import("../../vite.config")
  if (typeof config !== "function") throw new Error("Expected config factory")
  return config({ mode, command, isPreview: false })
}

// 自前の設定生成からpluginへの引数を検査する。実ビルドやmapのアップロード・削除は実行しない。
test.each(["production", "development"])(
  "%s の build 設定は hidden map を有効にし、pluginへ認証情報と対象pathを渡す",
  async (mode) => {
    const config = await configure(mode, "build")
    expect(config.build?.sourcemap).toBe("hidden")
    expect(config.plugins).toContainEqual({ name: "sentry-fixture" })
    expect(sentryPlugin).toHaveBeenCalledExactlyOnceWith({
      telemetry: false,
      authToken: "synthetic-upload-token",
      org: "fixture-org",
      project: "fixture-project",
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
  "%s の serve 設定は Sentry plugin と source map を無効にする",
  async (mode) => {
    const config = await configure(mode, "serve")
    expect(config.build?.sourcemap).toBe(false)
    expect(sentryPlugin).not.toHaveBeenCalled()
  },
)

for (const mode of ["production", "development"]) {
  test.each(["SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT"] as const)(
    `${mode} の build 設定は %s が空なら Sentry plugin と source map を無効にする`,
    async (key) => {
      credentials[key] = ""
      const config = await configure(mode, "build")
      expect(config.build?.sourcemap).toBe(false)
      expect(sentryPlugin).not.toHaveBeenCalled()
    },
  )
}
