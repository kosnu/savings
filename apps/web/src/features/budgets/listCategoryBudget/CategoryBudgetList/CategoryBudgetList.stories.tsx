import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"

import { createQueryClient } from "../../../../lib/queryClient"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { categoryBudgets } from "../../../../test/data/categoryBudgets"
import { createCategoryBudgetHandlers } from "../../../../test/msw/handlers/categoryBudgets"
import { CategoryBudgetList } from "./CategoryBudgetList"

const meta = {
  title: "Features/Budgets/CategoryBudgetList",
  component: CategoryBudgetList,
  parameters: {
    msw: {
      handlers: createCategoryBudgetHandlers(),
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
} satisfies Meta<typeof CategoryBudgetList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
  parameters: {
    msw: {
      handlers: createCategoryBudgetHandlers({
        get: { response: [] },
      }),
    },
  },
}

export const Loading: Story = {
  parameters: {
    msw: {
      handlers: createCategoryBudgetHandlers({
        get: { response: [], durationOrMode: "infinite" },
      }),
    },
  },
}

export const FetchError: Story = {
  parameters: {
    msw: {
      handlers: createCategoryBudgetHandlers({
        get: { error: true },
      }),
    },
  },
}

export const DuplicateCategory: Story = {
  parameters: {
    msw: {
      handlers: createCategoryBudgetHandlers({
        get: {
          response: [
            {
              ...categoryBudgets[0],
              category: { id: 10, name: "Food" },
            },
            {
              ...categoryBudgets[2],
              category: { id: 10, name: "Food" },
            },
          ],
        },
      }),
    },
  },
}
