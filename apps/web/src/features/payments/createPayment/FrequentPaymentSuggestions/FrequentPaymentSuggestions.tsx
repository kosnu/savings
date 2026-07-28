import { Card, Flex, Heading, Text } from "@radix-ui/themes"
import { memo, useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { toCurrency } from "../../../../utils/toCurrency"
import type { FrequentPayment } from "../frequentPayment"
import { useFrequentPayments } from "../useFrequentPayments"

import styles from "./FrequentPaymentSuggestions.module.css"

interface FrequentPaymentSuggestionsProps {
  bookId: number
  disabled?: boolean
  onSelect: (payment: FrequentPayment) => void
}

export const FrequentPaymentSuggestions = memo(function FrequentPaymentSuggestions({
  bookId,
  disabled = false,
  onSelect,
}: FrequentPaymentSuggestionsProps) {
  const [referenceDate] = useState(() => new Date())
  const { payments, isPending, isError } = useFrequentPayments(bookId, referenceDate)
  const { t } = useTranslation()
  const headingId = useId()

  if (isPending || isError || !payments || payments.length === 0) {
    return null
  }

  return (
    <Flex direction="column" gap="2">
      <Heading id={headingId} as="h3" size="2">
        {t("payments.create.frequent.label")}
      </Heading>
      <Flex asChild gap="2" wrap="nowrap">
        <fieldset aria-labelledby={headingId} className={styles.group}>
          {payments.map((payment) => {
            const amount = toCurrency(payment.amount)
            const category = payment.categoryName ?? t("payments.category.none")

            return (
              <Card
                key={JSON.stringify([payment.note, payment.amount, payment.categoryId])}
                asChild
                size="1"
                variant="surface"
              >
                <button
                  type="button"
                  disabled={disabled}
                  className={styles.candidate}
                  aria-label={t("payments.create.frequent.select", {
                    note: payment.note,
                    amount,
                    category,
                  })}
                  onClick={() => onSelect(payment)}
                >
                  <Flex direction="column" align="start" gap="2">
                    <Text size="2" weight="medium" className={styles.value}>
                      {payment.note}
                    </Text>
                    <Flex gap="3" wrap="wrap">
                      <Text size="1" color="gray" className={styles.value}>
                        {amount}
                      </Text>
                      <Text size="1" color="gray" className={styles.value}>
                        {category}
                      </Text>
                    </Flex>
                  </Flex>
                </button>
              </Card>
            )
          })}
        </fieldset>
      </Flex>
    </Flex>
  )
})
