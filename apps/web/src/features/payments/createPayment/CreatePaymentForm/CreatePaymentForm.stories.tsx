import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, fn, userEvent, waitFor, within } from "storybook/test"

import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { createCategoryHandlers } from "../../../../test/msw/handlers/categories"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { CreatePaymentForm } from "./CreatePaymentForm"

const meta = {
  title: "Features/Payments/CreatePayment/CreatePaymentForm",
  component: CreatePaymentForm,
  parameters: {
    layout: "centered",
    msw: {
      handlers: [...createPaymentHandlers(), ...createCategoryHandlers()],
    },
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {
    bookId: 1,
    onCancel: fn(),
  },
  decorators: (Story) => {
    return (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    )
  },
} satisfies Meta<typeof CreatePaymentForm>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onSuccess: fn(),
  },
}

export const Saving: Story = {
  parameters: {
    msw: {
      handlers: [
        ...createPaymentHandlers({ create: { durationOrMode: "infinite" } }),
        ...createCategoryHandlers(),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole("textbox", { name: /amount/i }), "1080")
    const submitButton = canvas.getByRole("button", { name: "Create" })
    await userEvent.click(submitButton)
    await expect(submitButton).toBeDisabled()
  },
}

export const SaveError: Story = {
  args: { onError: fn() },
  parameters: {
    docs: {
      description: {
        story:
          "現行実装は失敗をonErrorへ通知するだけで、フォーム内のエラー表示はありません。入力を保持する状態を再現します。",
      },
    },
    msw: {
      handlers: [
        ...createPaymentHandlers({ create: { error: true } }),
        ...createCategoryHandlers(),
      ],
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole("textbox", { name: /amount/i }), "1080")
    await userEvent.click(canvas.getByRole("button", { name: "Create" }))
    await waitFor(async () => expect(args.onError).toHaveBeenCalled())
    await expect(canvas.getByRole("textbox", { name: /amount/i })).toHaveValue("1080")
  },
}
