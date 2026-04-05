import type { Meta, StoryObj } from "@storybook/react-vite"

import { createStoryRouter, paymentsRouteBuilder } from "../../../../test/helpers/routerDecorator"
import { categoryHandlers } from "../../../../test/msw/handlers/categories"
import { CategoryField } from "./CategoryField"

const meta = {
  title: "Features/CreatePayment/CategoryField",
  component: CategoryField,
  parameters: {
    layout: "centered",
    msw: {
      handlers: categoryHandlers,
    },
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {},
  decorators: [createStoryRouter("/payments?year=2025&month=04", paymentsRouteBuilder)],
} satisfies Meta<typeof CategoryField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}
