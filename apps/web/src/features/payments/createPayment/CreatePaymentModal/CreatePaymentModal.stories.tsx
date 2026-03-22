import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { within } from "@testing-library/react"
import { expect, fireEvent, fn, userEvent, waitFor } from "storybook/test"

import { createQueryClient } from "../../../../lib/queryClient"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
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
    const queryClient = createQueryClient()

    return (
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <Story />
        </QueryClientProvider>
      </ThemeProvider>
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
    const dialog = await body.findByRole("dialog", { name: /create payment/i })
    expect(dialog).toBeInTheDocument()
    expect(await within(dialog).findByLabelText(/amount/i)).toBeInTheDocument()
  },
}

export const NonDismissible: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const openButton = canvas.getByRole("button", { name: /create payment/i })
    await userEvent.click(openButton)

    const body = within(canvasElement.ownerDocument.body)
    const dialog = await body.findByRole("dialog", { name: /create payment/i })
    expect(dialog).toBeInTheDocument()

    const bodyElement = canvasElement.ownerDocument.body
    fireEvent.pointerDown(bodyElement)
    fireEvent.click(bodyElement)
    expect(body.getByRole("dialog", { name: /create payment/i })).toBeInTheDocument()

    await userEvent.keyboard("{Escape}")

    expect(body.getByRole("dialog", { name: /create payment/i })).toBeInTheDocument()
    expect(await within(dialog).findByRole("button", { name: /cancel/i })).toBeInTheDocument()
  },
}

export const ContinuousCreationEnabled: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    const openButton = canvas.getByRole("button", { name: /create payment/i })
    await userEvent.click(openButton)

    const dialog = await body.findByRole("dialog", { name: /create payment/i })
    await within(dialog).findByLabelText(/amount/i)

    const checkbox = within(dialog).getByRole("checkbox", { name: /continue creating/i })
    await userEvent.click(checkbox)
    expect(checkbox).toBeChecked()

    const categorySelect = within(dialog).getByRole("combobox", { name: /category/i })
    await userEvent.click(categorySelect)

    const listbox = await body.findByRole("listbox")
    await waitFor(() => {
      expect(within(listbox).queryByLabelText(/loading/)).not.toBeInTheDocument()
    })

    const categoryOption = await within(listbox).findByRole("option", {
      name: /food/i,
    })
    await userEvent.click(categoryOption)

    const amountInput = within(dialog).getByLabelText(/amount/i)
    await userEvent.type(amountInput, "1000")

    const noteInput = within(dialog).getByLabelText(/note/i)
    await userEvent.type(noteInput, "Test payment")

    const submitButton = within(dialog).getByRole("button", {
      name: /create/i,
    })
    await userEvent.click(submitButton)

    await waitFor(
      () => {
        expect(
          within(body.getByRole("dialog", { name: /create payment/i })).getByLabelText(/amount/i),
        ).toBeInTheDocument()
      },
      { timeout: 3000 },
    )

    await waitFor(
      () => {
        const amountInputAfterSubmit = within(
          body.getByRole("dialog", { name: /create payment/i }),
        ).getByLabelText(/amount/i)
        expect(amountInputAfterSubmit).toHaveValue("")
      },
      { timeout: 1000 },
    )

    const checkboxAfterSubmit = within(
      body.getByRole("dialog", { name: /create payment/i }),
    ).getByRole("checkbox", {
      name: /continue creating/i,
    })
    expect(checkboxAfterSubmit).toBeChecked()

    expect(args.onSuccess).toHaveBeenCalled()
  },
}

export const ContinuousCreationDisabled: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    const openButton = canvas.getByRole("button", { name: /create payment/i })
    await userEvent.click(openButton)

    const dialog = await body.findByRole("dialog", { name: /create payment/i })
    await within(dialog).findByLabelText(/amount/i)

    const checkbox = within(dialog).getByRole("checkbox", { name: /continue creating/i })
    expect(checkbox).not.toBeChecked()

    const categorySelect = within(dialog).getByRole("combobox", { name: /category/i })
    await userEvent.click(categorySelect)

    const listbox = await body.findByRole("listbox")
    await waitFor(() => {
      expect(within(listbox).queryByLabelText(/loading/)).not.toBeInTheDocument()
    })

    const categoryOption = await within(listbox).findByRole("option", {
      name: /food/i,
    })
    await userEvent.click(categoryOption)

    const amountInput = within(dialog).getByLabelText(/amount/i)
    await userEvent.type(amountInput, "2000")

    const noteInput = within(dialog).getByLabelText(/note/i)
    await userEvent.type(noteInput, "Test payment without continuous mode")

    const submitButton = within(dialog).getByRole("button", {
      name: /create/i,
    })
    await userEvent.click(submitButton)

    await waitFor(
      () => {
        expect(args.onSuccess).toHaveBeenCalled()
      },
      { timeout: 3000 },
    )
  },
}
