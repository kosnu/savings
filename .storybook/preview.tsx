import type { Preview } from "@storybook/react"
import React from "react"
import "../src/assets/global.module.css"
import { BrowserRouter } from "react-router-dom"

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
      <BrowserRouter>
        <Story />
      </BrowserRouter>
    ),
  ],
}

export default preview
