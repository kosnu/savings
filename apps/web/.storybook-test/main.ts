import type { StorybookConfig } from "@storybook/react-vite"

const config: StorybookConfig = {
  stories: ["../src/app/routes/**/*.stories.tsx", "../src/app/Sidebar/Sidebar.stories.tsx"],
  addons: ["storybook-addon-mock-date", "@storybook/addon-vitest"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
}

export default config
