import type { Meta, StoryObj } from "@storybook/react-vite"

import { DataManagementSettings } from "./DataManagementSettings"

const meta = {
  title: "Pages/DataManagementSettings",
  component: DataManagementSettings,
  tags: ["autodocs", "browser-test"],
} satisfies Meta<typeof DataManagementSettings>

export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
