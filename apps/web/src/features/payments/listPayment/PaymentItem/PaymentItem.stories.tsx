import { Table } from "@radix-ui/themes"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { within } from "@testing-library/react"
import { expect, fn } from "storybook/test"
import { foodCat } from "../../../../test/data/categories"
import { payments } from "../../../../test/data/payments"
import { formatDateToLocaleString } from "../../../../utils/formatter/formatDateToLocaleString"
import { PaymentItem } from "./PaymentItem"

const meta = {
  title: "Features/ListPayment/PaymentItem",
  component: PaymentItem,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {},
  args: {
    onDeleteSuccess: fn(),
  },
  decorators: (Story) => {
    return (
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Title</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell align="right">
              Price&nbsp;(¥)
            </Table.ColumnHeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          <Story />
        </Table.Body>
      </Table.Root>
    )
  },
} satisfies Meta<typeof PaymentItem>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    payment: payments[0],
    category: foodCat,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const title = payments[0].note
    const date = formatDateToLocaleString(payments[0].date)
    const price = payments[0].amount
    expect(canvas.getByText(title)).toBeInTheDocument()
    expect(canvas.getByText(date)).toBeInTheDocument()
    expect(canvas.getByText(price)).toBeInTheDocument()
    expect(
      canvas.getByRole("button", { name: "Payment actions" }),
    ).toBeInTheDocument()
  },
}
