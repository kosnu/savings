import { defineConfig } from "cf/config"

export default defineConfig({
  worker: {
    name: "burneto",
    compatibilityDate: "2026-09-18",
    domains: ["burneto.com"],
    assets: {
      notFoundHandling: "single-page-application",
    },
  },
})
