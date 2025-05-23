import { Table } from "@radix-ui/themes"
import type { Payment } from "../../../types/payment"
import { formatDateToLocaleString } from "../../../utils/formatter/formatDateToLocaleString"

interface PaymentItemProps {
  payment: Payment
}

export function PaymentItem({ payment }: PaymentItemProps) {
  return (
    <Table.Row aria-label="payment-item">
      <Table.RowHeaderCell>
        {formatDateToLocaleString(payment.date)}
      </Table.RowHeaderCell>
      <Table.Cell>{payment.title}</Table.Cell>
      <Table.Cell align="right">{payment.price}</Table.Cell>
    </Table.Row>
  )
}
