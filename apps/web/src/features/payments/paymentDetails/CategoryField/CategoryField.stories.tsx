import type { Meta, StoryObj } from "@storybook/react-vite"
import { QueryClientProvider } from "@tanstack/react-query"
import { expect, fn, userEvent, within } from "storybook/test"

import { createQueryClient } from "../../../../lib/queryClient"
import { SnackbarProvider } from "../../../../providers/snackbar/SnackbarProvider"
import { ThemeProvider } from "../../../../providers/theme/ThemeProvider"
import { createCategoryHandlers, categoryHandlers } from "../../../../test/msw/handlers/categories"
import { createPaymentHandlers } from "../../../../test/msw/handlers/payments"
import { CategoryField } from "./CategoryField"

const meta = {
  title: "Features/Payments/PaymentDetails/CategoryField",
  component: CategoryField,
  parameters: {
    msw: {
      handlers: [...createPaymentHandlers(), ...categoryHandlers],
    },
  },
  args: {
    bookId: 1,
    paymentId: 1,
    categoryId: 10,
    categoryName: "Food",
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={createQueryClient()}>
        <ThemeProvider>
          <SnackbarProvider>
            <Story />
          </SnackbarProvider>
        </ThemeProvider>
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof CategoryField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onEditStart: fn(),
    onEditEnd: fn(),
  },
}

export const None: Story = {
  args: {
    categoryId: null,
    categoryName: "None",
    onEditStart: fn(),
    onEditEnd: fn(),
  },
}

export const RealNoneCategory: Story = {
  args: {
    categoryId: 999,
    categoryName: "None",
    onEditStart: fn(),
    onEditEnd: fn(),
  },
}

export const Loading: Story = {
  args: { onEditStart: fn(), onEditEnd: fn() },
  parameters: {
    msw: {
      handlers: [
        ...createPaymentHandlers({}),
        ...createCategoryHandlers({ get: { durationOrMode: "infinite" } }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(document.body)
    await userEvent.click(canvas.getByRole("button", { name: /edit category/i }))
    await userEvent.click(canvas.getByRole("combobox"))
    await body.findByRole("option", { name: /loading/i })
  },
}

export const FetchError: Story = {
  args: { onEditStart: fn(), onEditEnd: fn() },
  parameters: {
    msw: {
      handlers: [...createPaymentHandlers({}), ...createCategoryHandlers({ get: { error: true } })],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(document.body)
    await userEvent.click(canvas.getByRole("button", { name: /edit category/i }))
    await userEvent.click(canvas.getByRole("combobox"))
    await body.findByRole("option", { name: /error/i }, { timeout: 5000 })
  },
}

export const Saving: Story = {
  args: { onEditStart: fn(), onEditEnd: fn() },
  parameters: {
    msw: {
      handlers: [
        ...createPaymentHandlers({ update: { durationOrMode: "infinite" } }),
        ...createCategoryHandlers({}),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(document.body)
    await userEvent.click(canvas.getByRole("button", { name: /edit category/i }))
    await userEvent.click(canvas.getByRole("combobox"))
    await userEvent.click(await body.findByRole("option", { name: "Daily Necessities" }))
    await expect(canvas.getByRole("combobox")).toBeDisabled()
  },
}

export const SaveError: Story = {
  args: { onEditStart: fn(), onEditEnd: fn() },
  parameters: {
    msw: {
      handlers: [
        ...createPaymentHandlers({ update: { error: true } }),
        ...createCategoryHandlers({}),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const body = within(document.body)
    await userEvent.click(canvas.getByRole("button", { name: /edit category/i }))
    await userEvent.click(canvas.getByRole("combobox"))
    await userEvent.click(await body.findByRole("option", { name: "Daily Necessities" }))
    await expect(
      await body.findByText("Failed to update category.", { selector: "span" }),
    ).toBeVisible()
  },
}
