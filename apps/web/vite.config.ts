import { cloudflare } from "@cloudflare/vite-plugin"
import { sentryVitePlugin } from "@sentry/vite-plugin"
import { devtools as tanstackDevtools } from "@tanstack/devtools-vite"
import react from "@vitejs/plugin-react"
import { defineConfig, lazyPlugins, loadEnv } from "vite-plus"

// https://vitejs.dev/config/
export default defineConfig(({ command, isPreview, mode }) => {
  const buildEnv = loadEnv(mode, process.cwd(), "")
  const sentryEnabled =
    mode === "production" &&
    Boolean(buildEnv.SENTRY_AUTH_TOKEN && buildEnv.SENTRY_ORG && buildEnv.SENTRY_PROJECT)
  const plugins = lazyPlugins(() => [
    ...(command === "build" || isPreview ? cloudflare() : []),
    ...react(),
    ...tanstackDevtools(),
    ...(sentryEnabled
      ? sentryVitePlugin({
          authToken: buildEnv.SENTRY_AUTH_TOKEN,
          org: buildEnv.SENTRY_ORG,
          project: buildEnv.SENTRY_PROJECT,
          sourcemaps: {
            assets: ["./.cloudflare/output/v0/workers/default/assets/**"],
            filesToDeleteAfterUpload: [
              "./.cloudflare/output/v0/workers/default/assets/**/*.js.map",
              "./.cloudflare/output/v0/workers/default/assets/**/*.css.map",
            ],
          },
        })
      : []),
  ])

  return {
    plugins,
    css: {
      modules: {
        localsConvention: "dashes",
      },
    },
    build: {
      sourcemap: sentryEnabled ? "hidden" : false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules")) {
              if (id.includes("@radix-ui")) {
                return "vendor-radix"
              }
              return "vendor"
            }
          },
        },
      },
    },
  }
})
