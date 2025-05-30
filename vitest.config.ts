import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globalSetup: ["./src/test/globalSetup.ts"],
    environment: "jsdom",
    setupFiles: ["./vitest-setup.ts"],
    env: {
      // TODO: .env.test から読み取る
      VITE_FIREBASE_API_KEY: "xxx",
      VITE_FIREBASE_PROJECT_ID: "savings-test",
      VITE_FIRESTORE_EMULATOR_HOST: "localhost:8080",
      VITE_FIREBASE_AUTH_DOMAIN: "http://localhost:9099",
    },
    fakeTimers: {
      toFake: [
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "setImmediate",
        "clearImmediate",
        "Date",
      ],
    },
  },
})
