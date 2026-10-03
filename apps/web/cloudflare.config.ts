import { defineConfig } from "cf/config"

export default defineConfig(({ mode, isPreview }) => ({
  worker: {
    // Preview は本番 Worker・custom domain を使わない。
    name: isPreview || mode === "development" ? "burneto-dev" : "burneto",
    compatibilityDate: "2026-09-18",
    ...(isPreview || mode === "development"
      ? { workersDev: true, domains: [] }
      : { domains: ["burneto.com"] }),
    assets: {
      notFoundHandling: "single-page-application",
    },
  },
}))
