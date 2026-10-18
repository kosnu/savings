import { runInNewContext } from "node:vm"

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
    const release = "a".repeat(40)
    vi.stubEnv("SENTRY_RELEASE", release)
    const config = await configure(mode, "build")
    expect(config.build?.sourcemap).toBe("hidden")
    const options = {
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
    }
    expect(sentryPlugin).toHaveBeenCalledExactlyOnceWith(options)

    const { sentryVitePlugin } =
      await vi.importActual<typeof import("@sentry/vite-plugin")>("@sentry/vite-plugin")
    const plugin = sentryVitePlugin(options).find(
      (entry) => "renderChunk" in entry && typeof entry.renderChunk === "function",
    )
    if (!plugin || !("renderChunk" in plugin) || typeof plugin.renderChunk !== "function") {
      throw new Error("Expected renderChunk")
    }
    const rendered = Reflect.apply(plugin.renderChunk, {}, [
      "globalThis.syntheticBuild = true;",
      { fileName: "assets/synthetic.js", facadeModuleId: "/synthetic.js" },
      {},
      {},
    ])
    if (
      typeof rendered !== "object" ||
      rendered === null ||
      !("code" in rendered) ||
      typeof rendered.code !== "string"
    ) {
      throw new Error("Expected rendered JavaScript")
    }
    const runtime: Record<string, unknown> = {}
    runInNewContext(rendered.code, runtime)
    expect(runtime.SENTRY_RELEASE).toEqual({ id: release })
    expect(runtime.syntheticBuild).toBe(true)
  },
)

test.each(["production", "development"])(
  "%s の local サーバーでは管理 token を使わない",
  async (mode) => {
    const config = await configure(mode, "serve")
    expect(config.build?.sourcemap).toBe(false)
    expect(sentryPlugin).not.toHaveBeenCalled()
  },
)

test.each(["production", "development"])(
  "%s の認証なし CI ではアップロードしない",
  async (mode) => {
    credentials.SENTRY_AUTH_TOKEN = ""
    const config = await configure(mode, "build")
    expect(config.build?.sourcemap).toBe(false)
    expect(sentryPlugin).not.toHaveBeenCalled()
  },
)
