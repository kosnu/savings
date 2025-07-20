import { Table } from "@radix-ui/themes"
import { ActionMenuButton } from "../../../components/payments/PaymentActionMenuButton"
import type { Category } from "../../../types/category"
import type { Payment } from "../../../types/payment"
import { formatDateToLocaleString } from "../../../utils/formatter/formatDateToLocaleString"

interface PaymentItemProps {
  category: Category
  payment: Payment
  onDeleteSuccess: () => void
}

export function PaymentItem({
  category,
  payment,
  onDeleteSuccess,
}: PaymentItemProps) {
  return (
    <Table.Row aria-label="payment-item">
      <Table.RowHeaderCell>
        {formatDateToLocaleString(payment.date)}
      </Table.RowHeaderCell>
      <Table.Cell>{category.name}</Table.Cell>
      <Table.Cell>{payment.note}</Table.Cell>
      <Table.Cell align="right">{payment.amount}</Table.Cell>
      <Table.Cell align="right">
        <ActionMenuButton payment={payment} onDeleteSuccess={onDeleteSuccess} />
      </Table.Cell>
    </Table.Row>
  )
}
