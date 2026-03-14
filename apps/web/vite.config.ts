import { sentryVitePlugin } from "@sentry/vite-plugin"
import { devtools as tanstackDevtools } from "@tanstack/devtools-vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const buildEnv = loadEnv(mode, process.cwd(), "")
  const sentryEnabled =
    mode === "production" &&
    Boolean(buildEnv.SENTRY_AUTH_TOKEN && buildEnv.SENTRY_ORG && buildEnv.SENTRY_PROJECT)

  return {
    plugins: [
      react(),
      tanstackDevtools(),
      ...(sentryEnabled
        ? [
            sentryVitePlugin({
              authToken: buildEnv.SENTRY_AUTH_TOKEN,
              org: buildEnv.SENTRY_ORG,
              project: buildEnv.SENTRY_PROJECT,
              sourcemaps: {
                filesToDeleteAfterUpload: ["./dist/**/*.js.map", "./dist/**/*.css.map"],
              },
            }),
          ]
        : []),
    ],
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
