import type { StorybookConfig } from "@storybook/react-vite"

// Storybook は既定で MSW backed stories を使うため、ローカルの env ファイルなしでも
// アプリ共通の env validation が通るように非 secret の既定値を補う。
process.env.VITE_SUPABASE_URL ??= "http://127.0.0.1:54321"
process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??= "test-dummy-key"

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: ["storybook-addon-mock-date", "@storybook/addon-vitest", "@storybook/addon-docs"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
}
export default config
