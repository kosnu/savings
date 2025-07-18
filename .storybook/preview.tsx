import type { Preview } from "@storybook/react-vite"
// biome-ignore lint: noUnusedImports: これがないとテスト実行時に `React is not defined` エラーが起きる
import React from "react"
import { SnackbarProvider } from "../src/shared/snackbar"
import { ThemeProvider } from "../src/utils/theme/ThemeProvider"

import "../src/assets/global.module.css"

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <SnackbarProvider>
          <Story />
        </SnackbarProvider>
      </ThemeProvider>
    ),
  ],
}

export default preview
