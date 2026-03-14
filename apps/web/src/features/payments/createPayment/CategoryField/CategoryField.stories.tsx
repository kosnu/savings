import type { Meta, StoryObj } from "@storybook/react-vite"
import { expect, userEvent, waitFor, within } from "storybook/test"

import { createStoryRouter, paymentsRouteBuilder } from "../../../../test/helpers/routerDecorator"
import { CategoryField } from "./CategoryField"

const meta = {
  title: "Features/CreatePayment/CategoryField",
  component: CategoryField,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {},
  decorators: [createStoryRouter("/payments?year=2025&month=04", paymentsRouteBuilder)],
} satisfies Meta<typeof CategoryField>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const Filled: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const select = canvas.getByRole("combobox", { name: /category/i })
    await userEvent.click(select)

    const body = within(canvasElement.ownerDocument.body)
    const listbox = await body.findByRole("listbox")

    await waitFor(() => {
      // "loading" ラベルの要素が存在しないことを確認
      expect(within(listbox).queryByLabelText(/loading/)).not.toBeInTheDocument()
    })

    const option = await within(listbox).findByRole("option", {
      name: /food/i,
    })
    await userEvent.click(option)
  },
}
