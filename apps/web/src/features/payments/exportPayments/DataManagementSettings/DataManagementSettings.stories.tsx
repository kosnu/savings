import type { Meta, StoryObj } from "@storybook/react-vite"

import { DataManagementSettings } from "./DataManagementSettings"

const meta = {
  title: "Features/Payments/DataManagementSettings",
  component: DataManagementSettings,
  tags: ["autodocs"],
} satisfies Meta<typeof DataManagementSettings>

export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
