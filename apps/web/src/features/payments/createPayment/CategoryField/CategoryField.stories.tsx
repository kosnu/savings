import type { Meta, StoryObj } from "@storybook/react-vite"
import { userEvent, within } from "storybook/test"

import { createCategoryHandlers, categoryHandlers } from "../../../../test/msw/handlers/categories"
import { CategoryField } from "./CategoryField"

const meta = {
  title: "Features/Payments/CreatePayment/CategoryField",
  component: CategoryField,
  parameters: {
    layout: "centered",
    msw: {
      handlers: categoryHandlers,
    },
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof CategoryField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const Loading: Story = {
  parameters: {
    msw: { handlers: createCategoryHandlers({ get: { durationOrMode: "infinite" } }) },
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("combobox"))
    await within(document.body).findByRole("option", { name: /loading/i })
  },
}

export const FetchError: Story = {
  parameters: { msw: { handlers: createCategoryHandlers({ get: { error: true } }) } },
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("combobox"))
    await within(document.body).findByRole("option", { name: /error/i }, { timeout: 5000 })
  },
}
