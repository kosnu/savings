import { Table } from "@radix-ui/themes"
import { ActionMenuButton } from "../../../components/payments/PaymentActionMenuButton"
import type { Category } from "../../../types/category"
import type { Payment } from "../../../types/payment"
import { formatDateToLocaleString } from "../../../utils/formatter/formatDateToLocaleString"

interface PaymentItemProps {
  category: Category
  payment: Payment
}

export function PaymentItem({ category, payment }: PaymentItemProps) {
  return (
    <Table.Row aria-label="payment-item">
      <Table.RowHeaderCell>
        {formatDateToLocaleString(payment.date)}
      </Table.RowHeaderCell>
      <Table.Cell>{category.name}</Table.Cell>
      <Table.Cell>{payment.note}</Table.Cell>
      <Table.Cell align="right">{payment.amount}</Table.Cell>
      <Table.Cell align="right">
        <ActionMenuButton payment={payment} />
      </Table.Cell>
    </Table.Row>
  )
}
