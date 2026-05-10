import type { Meta, StoryObj } from "@storybook/react-vite"

import { createCategorySettingsHandlers } from "../../../../test/msw/handlers/categorySettings"
import { CategorySettingsList } from "./CategorySettingsList"

const meta = {
  title: "Features/Categories/Components/CategorySettingsList",
  component: CategorySettingsList,
  tags: ["autodocs"],
  parameters: {
    msw: {
      handlers: createCategorySettingsHandlers(),
    },
  },
} satisfies Meta<typeof CategorySettingsList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
