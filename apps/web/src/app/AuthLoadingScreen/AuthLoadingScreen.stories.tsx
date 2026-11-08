import type { Meta, StoryObj } from "@storybook/react-vite"

import { AuthLoadingScreen } from "./AuthLoadingScreen"

const meta = {
  title: "App/AuthLoadingScreen",
  component: AuthLoadingScreen,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AuthLoadingScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
