import type { Meta, StoryObj } from "@storybook/react-vite"
import { PaymentCard } from "./PaymentCard"

const meta = {
  title: "Common/Payments/PaymentCard",
  component: PaymentCard,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {},
  decorators: (Story) => (
    <div style={{ width: "400px" }}>
      <Story />
    </div>
  ),
} satisfies Meta<typeof PaymentCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const Loading: Story = {
  args: {
    loading: true,
  },
}
