import type { StorybookConfig } from "@storybook/react-vite"

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: [
    "@storybook/addon-onboarding",
    "@storybook/addon-essentials",
    "@chromatic-com/storybook",
    "storybook-addon-mock-date",
    "@storybook/experimental-addon-test",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  env: {
    // TODO: .env.test から読み取る
    VITE_FIREBASE_API_KEY: "xxx",
    VITE_FIREBASE_PROJECT_ID: "savings-test",
    VITE_FIRESTORE_EMULATOR_HOST: "localhost:8080",
    VITE_FIREBASE_AUTH_DOMAIN: "http://localhost:9099",
  },
}
export default config
