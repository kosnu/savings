import type { Meta, StoryObj } from "@storybook/react-vite"

import { AppearanceSettings } from "./AppearanceSettings"

const meta = {
  title: "Features/Preferences/AppearanceSettings/AppearanceSettings",
  component: AppearanceSettings,
  tags: ["autodocs"],
} satisfies Meta<typeof AppearanceSettings>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
