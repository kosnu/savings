import type { StorybookConfig } from "@storybook/react-vite"

const config: StorybookConfig = {
  stories: ["../src/app/routes/**/*.stories.tsx"],
  addons: [
    "@storybook/addon-onboarding",
    "@chromatic-com/storybook",
    "storybook-addon-mock-date",
    "@storybook/addon-vitest",
    "@storybook/addon-docs",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
}

export default config
