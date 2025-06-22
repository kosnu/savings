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
    {
      const todayButton = await within(body).findByRole("button", {
        name: /today/i,
      })
      await userEvent.click(todayButton)
    }
    {
      const select = canvas.getByRole("combobox", { name: /category/i })
      await userEvent.click(select)

      const body = within(canvasElement.ownerDocument.body)
      const listbox = await body.findByRole("listbox")
      const option = await within(listbox).findByRole("option", {
        name: /food/i,
      })
      await userEvent.click(option)
    }
    {
      const noteTextfield = canvas.getByRole("textbox", { name: /note/i })
      await userEvent.type(noteTextfield, "Test")
    }
    {
      const amountTextfield = canvas.getByRole("spinbutton", {
        name: /amount/i,
      })
      await userEvent.type(amountTextfield, "1080")
    }
  },
}
