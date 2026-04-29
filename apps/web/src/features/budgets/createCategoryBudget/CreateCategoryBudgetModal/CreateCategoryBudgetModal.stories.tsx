import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"

import { createQueryClient } from "../../../../lib/queryClient"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { createCategoryHandlers } from "../../../../test/msw/handlers/categories"
import { createCategoryBudgetHandlers } from "../../../../test/msw/handlers/categoryBudgets"
import { CreateCategoryBudgetModal } from "./CreateCategoryBudgetModal"

const meta = {
  title: "Features/Budgets/CreateCategoryBudgetModal",
  component: CreateCategoryBudgetModal,
  parameters: {
    layout: "centered",
    msw: {
      handlers: [...createCategoryHandlers(), ...createCategoryBudgetHandlers()],
    },
  },
  tags: ["autodocs"],
  decorators: (Story) => {
    const queryClient = createQueryClient()

    return (
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      </ThemeProvider>
    )
  },
} satisfies Meta<typeof CreateCategoryBudgetModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
