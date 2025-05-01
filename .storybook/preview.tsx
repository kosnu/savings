import type { Preview } from "@storybook/react"
import React from "react"
import { BrowserRouter } from "react-router-dom"
import { ThemeProvider } from "../src/utils/theme/ThemeProvider"

import "@radix-ui/themes/styles.css"
import "../src/assets/global.module.css"
import "../src/assets/radixTheme.module.css"

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
        <BrowserRouter>
          <Story />
        </BrowserRouter>
      </ThemeProvider>
    ),
  ],
}

export default preview
