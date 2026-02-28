import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, within } from "storybook/test"
import { createStoryRouter } from "../../../../test/helpers/routerDecorator"
import { PaymentList } from "./PaymentList"

const meta = {
  title: "Features/ListPayment/PaymentList",
  component: PaymentList,
  parameters: {},
  tags: ["autodocs"],
  decorators: [createStoryRouter("/payments?year=2025&month=06")],
  argTypes: {},
  args: {
    onDeleteSuccess: fn(),
  },
} satisfies Meta<typeof PaymentList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(await canvas.findByLabelText("payment-list")).toBeInTheDocument()
    expect(await canvas.findAllByLabelText("payment-item")).toHaveLength(4)
  },
}
