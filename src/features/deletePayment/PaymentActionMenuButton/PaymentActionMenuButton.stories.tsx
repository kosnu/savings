import type { Meta, StoryObj } from "@storybook/react-vite"
import { within } from "@testing-library/react"
import { expect, userEvent } from "storybook/test"
import { payments } from "../../../test/data/payments"
import { PaymentActionMenuButton } from "./PaymentActionMenuButton"

const meta = {
  title: "Features/DeletePayment/PaymentActionMenuButton",
  component: PaymentActionMenuButton,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof PaymentActionMenuButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { payment_id: payments[0].id ?? "unknown" },
}

export const OpenMenu: Story = {
  args: { payment_id: payments[0].id ?? "unknown" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole("button")
    userEvent.click(button)
    const menu = await within(canvasElement.ownerDocument.body).findByRole(
      "menu",
    )
    expect(menu).toBeInTheDocument()
    expect(within(menu).getByText("Delete")).toBeInTheDocument()
  },
}
