import type { Preview } from "@storybook/react-vite"
import React from "react"
import { BrowserRouter } from "react-router-dom"
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
        <Story />
      </ThemeProvider>
    ),
  ],
}

export default preview
