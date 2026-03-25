import { ChevronRightIcon } from "@radix-ui/react-icons"
import { Badge, Button, Card, Flex, Text } from "@radix-ui/themes"
import type { MouseEvent } from "react"

import type { Category } from "../../../../types/category"
import type { Payment } from "../../../../types/payment"
import { formatDateToLocaleString } from "../../../../utils/formatter/formatDateToLocaleString"
import { toCurrency } from "../../../../utils/toCurrency"

import styles from "./PaymentItem.module.css"

const notePlaceholder = "No note"

interface PaymentItemProps {
  category: Category
  payment: Payment
  onOpen: (trigger: HTMLButtonElement) => void
}

export function PaymentItem({ category, payment, onOpen }: PaymentItemProps) {
  const dateLabel = formatDateToLocaleString(payment.date)
  const noteValue = payment.note ? payment.note : notePlaceholder
  const amountValue = toCurrency(payment.amount)

  const label = `${dateLabel} ${category.name} ${noteValue} ${amountValue}`

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onOpen(event.currentTarget)
  }

  return (
    <Button
      className={styles.trigger}
      variant="ghost"
      highContrast
      onClick={handleClick}
      aria-label={label}
    >
      <Card data-payment-card size="2">
        <Flex direction="column" gap="1">
          <Flex direction="row" justify="between" align="center" gap="2">
            <Flex direction="row" align="center" gap="2">
              <Text size="3" color="gray">
                {dateLabel}
              </Text>
              <Badge size="3">{category.name}</Badge>
            </Flex>
            <ChevronRightIcon className={styles.chevron} width="20" height="20" aria-hidden />
          </Flex>
          <Text data-has-note={!!payment.note} className={styles.note} color="gray" size="5">
            {noteValue}
          </Text>
          <Text align="right" size="6" weight="bold">
            {amountValue}
          </Text>
        </Flex>
      </Card>
    </Button>
  )
}
