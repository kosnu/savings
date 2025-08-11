import type { Meta, StoryObj } from "@storybook/react-vite"
import { within } from "@testing-library/react"
import { expect, fn, userEvent } from "storybook/test"
import { firebaseConfig } from "../../../../config/firebase/test"
import { FirestoreProvider } from "../../../../providers/firebase"
import { CreatePaymentModal } from "./CreatePaymentModal"

const meta = {
  title: "Features/CreatePayment/CreatePaymentModal",
  component: CreatePaymentModal,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {
    onSuccess: fn(),
  },
  decorators: (Story) => {
    return (
      <FirestoreProvider config={firebaseConfig}>
        <Story />
      </FirestoreProvider>
    )
  },
} satisfies Meta<typeof CreatePaymentModal>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const OpenModal: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const openButton = canvas.getByRole("button", { name: /create payment/i })
    await userEvent.click(openButton)

    const body = within(canvasElement.ownerDocument.body)
    expect(await body.findByRole("dialog")).toBeInTheDocument()
  },
}
