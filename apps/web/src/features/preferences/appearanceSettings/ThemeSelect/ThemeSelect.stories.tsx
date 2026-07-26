import type { Meta, StoryObj } from "@storybook/react-vite"

import { ThemeSelect } from "./ThemeSelect"

const meta = {
  title: "Features/Preferences/AppearanceSettings/ThemeSelect",
  component: ThemeSelect,
  tags: ["autodocs"],
} satisfies Meta<typeof ThemeSelect>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
