import type { Meta, StoryObj } from "@storybook/react-vite"

import { LanguageSelect } from "./LanguageSelect"

const meta = {
  title: "Features/Preferences/AppearanceSettings/LanguageSelect",
  component: LanguageSelect,
  tags: ["autodocs"],
} satisfies Meta<typeof LanguageSelect>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
