import type { Meta, StoryObj } from "@storybook/react-vite"

import { createStoryRouter } from "../../../../test/helpers/routerDecorator"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { RecentPayments } from "./RecentPayments"

const meta = {
  title: "Features/Payments/RecentPayments",
  component: RecentPayments,
  args: { bookId: 1, cacheScope: "recent-story" },
  decorators: [createStoryRouter("/")],
  parameters: { msw: { handlers: createPaymentHandlers() } },
  tags: ["autodocs"],
} satisfies Meta<typeof RecentPayments>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = {
  parameters: { msw: { handlers: createPaymentHandlers({ initialRows: [] }) } },
}
export const Loading: Story = {
  parameters: { msw: { handlers: createPaymentHandlers({ get: { durationOrMode: "infinite" } }) } },
}
export const Error: Story = {
  parameters: { msw: { handlers: createPaymentHandlers({ get: { error: true } }) } },
}
