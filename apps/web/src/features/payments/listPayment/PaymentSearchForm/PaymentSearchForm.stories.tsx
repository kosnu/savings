import type { Meta, StoryObj } from "@storybook/react-vite"

import { createStoryRouter, paymentsRouteBuilder } from "../../../../test/helpers/routerDecorator"
import { createCategoryHandlers } from "../../../../test/msw/handlers/categories"
import { PaymentSearchForm } from "./PaymentSearchForm"

const meta = {
  title: "Features/Payments/ListPayment/PaymentSearchForm",
  component: PaymentSearchForm,
  tags: ["autodocs"],
  parameters: { msw: { handlers: createCategoryHandlers() } },
} satisfies Meta<typeof PaymentSearchForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  decorators: [createStoryRouter("/payments?year=2025&month=6", paymentsRouteBuilder)],
}

export const Filtered: Story = {
  decorators: [createStoryRouter("/payments?year=2025&month=6&category=10", paymentsRouteBuilder)],
}
