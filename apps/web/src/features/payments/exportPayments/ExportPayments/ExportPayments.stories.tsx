import type { Meta, StoryObj } from "@storybook/react-vite"
import { userEvent, within } from "storybook/test"

import { selectDate } from "../../../../test/helpers/selectDate"
import { createBookHandlers } from "../../../../test/msw/handlers/books"
import { createPaymentExportHandlers } from "../../../../test/msw/handlers/paymentExports"
import { ExportPayments } from "./ExportPayments"

function parameters(options?: Parameters<typeof createPaymentExportHandlers>[0]) {
  return { msw: { handlers: [...createBookHandlers(), ...createPaymentExportHandlers(options)] } }
}

const meta = {
  title: "Features/Payments/ExportPayments",
  component: ExportPayments,
  tags: ["autodocs"],
  parameters: parameters(),
} satisfies Meta<typeof ExportPayments>

export default meta
type Story = StoryObj<typeof meta>

const submit: NonNullable<Story["play"]> = async ({ canvasElement }) => {
  const canvas = within(canvasElement)
  await selectDate(userEvent, canvas.getByLabelText(/Start date/), "2026-10-01")
  await selectDate(userEvent, canvas.getByLabelText(/End date/), "2026-10-31")
  await userEvent.click(canvas.getByRole("button", { name: "Download CSV" }))
}

export const Default: Story = {}
export const Pending: Story = {
  parameters: parameters({ durationOrMode: "infinite" }),
  play: submit,
}
export const Empty: Story = { parameters: parameters({ response: [] }), play: submit }
export const Failed: Story = { parameters: parameters({ error: true }), play: submit }
export const OverLimit: Story = { parameters: parameters({ count: 10_001 }), play: submit }
export const InvalidPeriod: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Download CSV" }))
  },
}

export const PeriodTooLong: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await selectDate(userEvent, canvas.getByLabelText(/Start date/), "2024-02-29")
    await selectDate(userEvent, canvas.getByLabelText(/End date/), "2025-03-01")
    await userEvent.click(canvas.getByRole("button", { name: "Download CSV" }))
  },
}
