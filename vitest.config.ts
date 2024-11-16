import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globalSetup: ["./src/test/globalSetup.ts"],
    environment: "jsdom",
    setupFiles: ["./vitest-setup.ts"],
  },
})
