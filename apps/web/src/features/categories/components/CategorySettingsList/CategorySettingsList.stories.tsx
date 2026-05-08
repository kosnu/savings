import type { Meta, StoryObj } from "@storybook/react-vite"

import { CategorySettingsList } from "./CategorySettingsList"

const meta = {
  title: "Features/Categories/Components/CategorySettingsList",
  component: CategorySettingsList,
  tags: ["autodocs"],
} satisfies Meta<typeof CategorySettingsList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
