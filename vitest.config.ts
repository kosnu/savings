import path from "node:path"
import { fileURLToPath } from "node:url"
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin"
import { defineConfig } from "vitest/config"

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    globalSetup: ["./src/test/globalSetup.ts"],
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
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
    projects: [
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/writing-tests/test-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, ".storybook"),
            tags: {
              exclude: ["skip"],
            },
            storybookScript: "npm run storybook --ci",
            storybookUrl: process.env.SB_URL,
          }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: "playwright",
            instances: [{ browser: "chromium" }],
          },
          setupFiles: [".storybook/vitest.setup.ts"],
        },
      },
    ],
  },
})
