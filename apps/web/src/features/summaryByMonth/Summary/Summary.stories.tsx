import { Container } from "@radix-ui/themes"
import type { Meta, StoryObj } from "@storybook/react-vite"

import { createStoryRouter, paymentsRouteBuilder } from "../../../test/helpers/routerDecorator"
import { createCategoryHandlers } from "../../../test/msw/handlers/categories"
import { createPaymentHandlers } from "../../../test/msw/handlers/payments"
import { Summary } from "./Summary"

const meta = {
  title: "Features/SummaryByMonth/Summary",
  component: Summary,
  parameters: {
    layout: "centered",
    msw: {
      handlers: [...createPaymentHandlers(), ...createCategoryHandlers()],
    },
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {},
  decorators: [
    createStoryRouter("/payments?year=2025&month=06", paymentsRouteBuilder),
    (Story) => (
      <Container size="4">
        <Story />
      </Container>
    ),
  ],
} satisfies Meta<typeof Summary>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}
