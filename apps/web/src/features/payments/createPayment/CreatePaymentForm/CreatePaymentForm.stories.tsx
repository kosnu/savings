import type { Meta, StoryObj } from "@storybook/react-vite"
import { within } from "@testing-library/react"
import { expect, fn, userEvent, waitFor } from "storybook/test"
import { firebaseConfig } from "../../../../config/firebase/test"
import { FirestoreProvider, initFirebase } from "../../../../providers/firebase"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
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
  beforeEach: async () => {
    initFirebase(firebaseConfig)
  },
  decorators: (Story) => {
    return (
      <ThemeProvider>
        <FirestoreProvider config={firebaseConfig}>
          <Story />
        </FirestoreProvider>
      </ThemeProvider>
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
    const datepicker = canvas.getByRole("textbox", { name: /date/i })
    await userEvent.click(datepicker)

    // NOTE: 今日の日付はデフォルトで選択されているので、あえてクリックしない
    {
      const select = await canvas.findByRole("combobox", { name: /category/i })
      await userEvent.click(select)

      const body = within(canvasElement.ownerDocument.body)
      const listbox = await body.findByRole("listbox")

      await waitFor(() => {
        // "loading" ラベルの要素が存在しないことを確認
        expect(
          within(listbox).queryByLabelText(/loading/),
        ).not.toBeInTheDocument()
      })

      const option = await within(listbox).findByRole("option", {
        name: /food/i,
      })
      await userEvent.click(option)
    }
    {
      const noteTextfield = canvas.getByRole("textbox", { name: /note/i })
      await userEvent.type(noteTextfield, "Test_FSf5qxLNxAC265uSTcNa")
    }
    {
      const amountTextfield = canvas.getByRole("textbox", { name: /amount/i })
      await userEvent.type(amountTextfield, "1080")
    }
  },
}

export const Empty: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const submitButton = canvas.getByRole("button", { name: /create/i })
    await userEvent.click(submitButton)

    expect(
      await canvas.findByText("Category can not be empty"),
    ).toBeInTheDocument()
    expect(await canvas.findByText("Note can not be empty")).toBeInTheDocument()
    expect(
      await canvas.findByText("Amount can not be empty"),
    ).toBeInTheDocument()
  },
}
