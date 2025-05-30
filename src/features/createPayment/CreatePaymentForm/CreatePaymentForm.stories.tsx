import type { Meta, StoryObj } from "@storybook/react-vite"
import { within } from "@testing-library/react"
import { fn, userEvent } from "storybook/test"
import { FiresotreTestProvider } from "../../../utils/firebase/FirebaseTestProvider"
import { CreatePaymentForm } from "./CreatePaymentForm"

const meta = {
  title: "Features/CreatePayment/CreatePaymentForm",
  component: CreatePaymentForm,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {
    onSuccess: fn(),
    onCancel: fn(),
  },
  decorators: (Story) => {
    return (
      <FiresotreTestProvider>
        <Story />
      </FiresotreTestProvider>
    )
  },
} satisfies Meta<typeof CreatePaymentForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const Fiiled: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const datepicker = canvas.getByRole("button", { name: /date/i })
    await userEvent.click(datepicker)

    const body = canvasElement.ownerDocument.body
    const todayButton = await within(body).findByRole("button", {
      name: /today/i,
    })
    await userEvent.click(todayButton)

    const titleTextfield = canvas.getByRole("textbox", { name: /title/i })
    await userEvent.type(titleTextfield, "Test")

    const priceTextfield = canvas.getByRole("spinbutton", { name: /price/i })
    await userEvent.type(priceTextfield, "1080")
  },
}
