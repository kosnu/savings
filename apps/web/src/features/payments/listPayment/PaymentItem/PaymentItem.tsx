import { Badge, Card, Flex, Text } from "@radix-ui/themes"
import { ActionMenuButton } from "../../../../components/payments/PaymentActionMenuButton"
import type { Category } from "../../../../types/category"
import type { Payment } from "../../../../types/payment"
import { formatDateToLocaleString } from "../../../../utils/formatter/formatDateToLocaleString"
import { toCurrency } from "../../../../utils/toCurrency"

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
    <Card aria-label="payment-item" size="2">
      <Flex direction="column" gap="1">
        <Flex direction="row" justify="between" align="center" gap="2">
          <Flex direction="row" align="center" gap="2">
            <Text size="3" color="gray">
              {formatDateToLocaleString(payment.date)}
            </Text>
            <Badge size="3">{category.name}</Badge>
          </Flex>
          <ActionMenuButton
            payment={payment}
            onDeleteSuccess={onDeleteSuccess}
          />
        </Flex>
        <Text size="5">{payment.note}</Text>
        <Text align="right" size="6" weight="bold">
          {toCurrency(payment.amount)}
        </Text>
      </Flex>
    </Card>
  )
}
