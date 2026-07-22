import type { Meta, StoryObj } from "@storybook/react-vite"

import { monthlyBudgets } from "../../../../test/data/monthlyBudgets"
import { createBookHandlers } from "../../../../test/msw/handlers/books"
import { createCategorySettingsHandlers } from "../../../../test/msw/handlers/categorySettings"
import { createMonthlyBudgetHandlers } from "../../../../test/msw/handlers/monthlyBudgets"
import { BookSettings } from "./BookSettings"

const meta = {
  title: "Features/Books/BookSettings",
  component: BookSettings,
  tags: ["autodocs"],
  parameters: {
    msw: {
      handlers: [
        ...createBookHandlers(),
        ...createMonthlyBudgetHandlers({
          get: { response: monthlyBudgets[3] },
        }),
        ...createCategorySettingsHandlers(),
      ],
    },
  },
} satisfies Meta<typeof BookSettings>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
