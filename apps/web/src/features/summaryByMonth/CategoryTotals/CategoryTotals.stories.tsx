import type { Meta, StoryObj } from "@storybook/react-vite"

import { createStoryRouter, paymentsRouteBuilder } from "../../../test/helpers/routerDecorator"
import { createCategoryHandlers } from "../../../test/msw/handlers/categories"
import { CategoryTotals } from "./CategoryTotals"

const meta = {
  title: "Features/SummaryByMonth/CategoryTotals",
  component: CategoryTotals,
  tags: ["autodocs"],
  parameters: {
    msw: {
      handlers: createCategoryHandlers(),
    },
  },
  decorators: [createStoryRouter("/payments?year=2025&month=06", paymentsRouteBuilder)],
} satisfies Meta<typeof CategoryTotals>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    chunkSize: 2,
  },
}
