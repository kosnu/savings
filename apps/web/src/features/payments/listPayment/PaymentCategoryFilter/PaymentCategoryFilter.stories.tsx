import type { Meta, StoryObj } from "@storybook/react-vite"
import { userEvent, within } from "storybook/test"

import { createStoryRouter, paymentsRouteBuilder } from "../../../../test/helpers/routerDecorator"
import { createCategoryHandlers } from "../../../../test/msw/handlers/categories"
import { PaymentCategoryFilter } from "./PaymentCategoryFilter"

const meta = {
  title: "Features/Payments/ListPayment/PaymentCategoryFilter",
  component: PaymentCategoryFilter,
  tags: ["autodocs"],
  decorators: [createStoryRouter("/payments?year=2025&month=06", paymentsRouteBuilder)],
  parameters: { msw: { handlers: createCategoryHandlers() } },
} satisfies Meta<typeof PaymentCategoryFilter>
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Loading: Story = {
  parameters: {
    msw: { handlers: createCategoryHandlers({ get: { durationOrMode: "infinite" } }) },
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("combobox"))
    await within(document.body).findByRole("option", { name: /loading/i })
  },
}
export const FetchError: Story = {
  parameters: { msw: { handlers: createCategoryHandlers({ get: { error: true } }) } },
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("combobox"))
    await within(document.body).findByRole("option", { name: /error/i }, { timeout: 5000 })
  },
}
