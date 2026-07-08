import { ChevronRightIcon } from "@radix-ui/react-icons"
import { Badge, Button, Card, Flex, Text } from "@radix-ui/themes"
import type { MouseEvent } from "react"
import { useTranslation } from "react-i18next"

import { getDateFormat } from "../../../../i18n"
import type { Payment, PaymentCategory } from "../../../../types/payment"
import { formatDateToLocaleString } from "../../../../utils/formatter/formatDateToLocaleString"
import { toCurrency } from "../../../../utils/toCurrency"

import styles from "./PaymentItem.module.css"

interface PaymentItemProps {
  category: PaymentCategory | null
  payment: Payment
  onOpen: (trigger: HTMLButtonElement) => void
}

export function PaymentItem({ category, payment, onOpen }: PaymentItemProps) {
  const { i18n, t } = useTranslation()
  const dateLabel = formatDateToLocaleString(
    payment.date,
    getDateFormat(i18n.resolvedLanguage),
    i18n.resolvedLanguage,
  )
  const noteValue = payment.note ? payment.note : t("payments.note.placeholder")
  const amountValue = toCurrency(payment.amount)

  const label = [dateLabel, category?.name, noteValue, amountValue].filter(Boolean).join(" ")

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
              {category ? <Badge size="3">{category.name}</Badge> : null}
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
