import { Button, Flex, Text } from "@radix-ui/themes"
import { memo, useState } from "react"
import { useTranslation } from "react-i18next"

import { useSupabaseSession } from "../../../../providers/supabase/useSupabaseSession"
import { toCurrency } from "../../../../utils/toCurrency"
import { useCurrentBook } from "../../../books"
import type { FrequentPayment } from "../frequentPayment"
import { useFrequentPayments } from "../useFrequentPayments"

import styles from "./FrequentPaymentSuggestions.module.css"

interface FrequentPaymentSuggestionsProps {
  disabled?: boolean
  onSelect: (payment: FrequentPayment) => void
}

export const FrequentPaymentSuggestions = memo(function FrequentPaymentSuggestions({
  disabled = false,
  onSelect,
}: FrequentPaymentSuggestionsProps) {
  const { session } = useSupabaseSession()
  const authUserId = session?.user.id
  const [referenceDate] = useState(() => new Date())

  if (!authUserId) {
    return null
  }

  return (
    <FrequentPaymentSuggestionsForCurrentBook
      authUserId={authUserId}
      disabled={disabled}
      onSelect={onSelect}
      referenceDate={referenceDate}
    />
  )
})

interface FrequentPaymentSuggestionsForCurrentBookProps extends FrequentPaymentSuggestionsProps {
  authUserId: string
  referenceDate: Date
}

function FrequentPaymentSuggestionsForCurrentBook({
  authUserId,
  disabled = false,
  onSelect,
  referenceDate,
}: FrequentPaymentSuggestionsForCurrentBookProps) {
  const { book, isPending, isError } = useCurrentBook(authUserId)

  if (isPending || isError || !book) {
    return null
  }

  return (
    <FrequentPaymentSuggestionsForBook
      bookId={book.id}
      disabled={disabled}
      onSelect={onSelect}
      referenceDate={referenceDate}
    />
  )
}

interface FrequentPaymentSuggestionsForBookProps extends FrequentPaymentSuggestionsProps {
  bookId: number
  referenceDate: Date
}

function FrequentPaymentSuggestionsForBook({
  bookId,
  disabled = false,
  onSelect,
  referenceDate,
}: FrequentPaymentSuggestionsForBookProps) {
  const { payments, isPending, isError } = useFrequentPayments(bookId, referenceDate)
  const { t } = useTranslation()

  if (isPending || isError || !payments || payments.length === 0) {
    return null
  }

  return (
    <Flex direction="column" gap="2">
      <Text size="2" weight="bold">
        {t("payments.create.frequent.label")}
      </Text>
      <Flex gap="2" wrap="wrap">
        {payments.map((payment) => {
          const amount = toCurrency(payment.amount)
          const category = payment.categoryName ?? t("payments.category.none")

          return (
            <Button
              key={JSON.stringify([payment.note, payment.amount, payment.categoryId])}
              type="button"
              variant="soft"
              size="1"
              radius="full"
              disabled={disabled}
              className={styles.candidate}
              aria-label={t("payments.create.frequent.select", {
                note: payment.note,
                amount,
                category,
              })}
              onClick={() => onSelect(payment)}
            >
              <Flex direction="column" align="start" gap="1">
                <Text className={styles.note}>{payment.note}</Text>
                <Text size="1" color="gray" className={styles.details}>
                  {amount} · {category}
                </Text>
              </Flex>
            </Button>
          )
        })}
      </Flex>
    </Flex>
  )
}
