import { Button, Flex, Separator, Skeleton, Text } from "@radix-ui/themes"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"

import { ResponsiveOverlay } from "../../../../components/overlay/ResponsiveOverlay"
import type { Payment, PaymentDetails, PaymentId } from "../../../../types/payment"
import { AmountField } from "../AmountField"
import { CategoryField } from "../CategoryField"
import { NoteField } from "../NoteField"
import { PaymentDateField } from "../PaymentDateField"
import { usePaymentDetails } from "../usePaymentDetails"

interface PaymentDetailsOverlayProps {
  paymentId: PaymentId | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete?: (payment: Payment) => void
}

export function PaymentDetailsOverlay({
  paymentId,
  open,
  onOpenChange,
  onDelete,
}: PaymentDetailsOverlayProps) {
  const { t } = useTranslation()
  const { data: payment, isLoading, error } = usePaymentDetails(paymentId)
  const [isEditingField, setIsEditingField] = useState(false)
  const hasPaymentId = paymentId !== null
  const hasPaymentDetails = payment !== null && payment !== undefined
  const canShowPaymentDetails = hasPaymentId && hasPaymentDetails
  const isNotFound = open && !isLoading && !error && !canShowPaymentDetails
  const description = error
    ? t("payments.details.loadError")
    : isNotFound
      ? t("payments.details.notFound")
      : t("payments.details.description")
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setIsEditingField(false)
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange],
  )
  const handleEditStart = useCallback(() => {
    setIsEditingField(true)
  }, [])
  const handleEditEnd = useCallback(() => {
    setIsEditingField(false)
  }, [])

  function handleEscapeKeyDown(event: KeyboardEvent) {
    if (!isEditingField) return
    event.preventDefault()
  }

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={handleOpenChange}
      onEscapeKeyDown={handleEscapeKeyDown}
      title={t("payments.details.title")}
      description={description}
    >
      {isLoading ? (
        <PaymentDetailsLoading />
      ) : hasPaymentDetails ? (
        <Flex direction="column" gap="4">
          <Flex direction="column" gap="4">
            <PaymentDateField
              paymentId={payment.id}
              date={payment.date}
              disabled={isEditingField}
              onEditStart={handleEditStart}
              onEditEnd={handleEditEnd}
            />
            <AmountField
              paymentId={payment.id}
              amount={payment.amount}
              disabled={isEditingField}
              onEditStart={handleEditStart}
              onEditEnd={handleEditEnd}
            />
            <CategoryField
              paymentId={payment.id}
              categoryId={payment.category?.id ?? null}
              categoryName={payment.category?.name ?? t("payments.category.none")}
              disabled={isEditingField}
              onEditStart={handleEditStart}
              onEditEnd={handleEditEnd}
            />
            <NoteField
              paymentId={payment.id}
              note={payment.note}
              disabled={isEditingField}
              onEditStart={handleEditStart}
              onEditEnd={handleEditEnd}
            />
          </Flex>
          {onDelete ? (
            <>
              <Separator size="4" />
              <Flex justify="end" pt="2">
                <Button color="red" variant="soft" onClick={() => onDelete(toPayment(payment))}>
                  {t("payments.details.delete")}
                </Button>
              </Flex>
            </>
          ) : null}
        </Flex>
      ) : null}
    </ResponsiveOverlay>
  )
}

function PaymentDetailsLoading() {
  const { t } = useTranslation()

  return (
    <Flex aria-label={t("payments.details.loadingAria")} direction="column" gap="4">
      <LoadingField label={t("date.label")} />
      <LoadingField label={t("amount.label")} />
      <LoadingField label={t("payments.category.label")} />
      <LoadingField label={t("payments.note.label")} />
    </Flex>
  )
}

function LoadingField({ label }: { label: string }) {
  const { t } = useTranslation()

  return (
    <Flex direction="column" gap="2">
      <Text as="p" size="2" weight="bold">
        {label}
      </Text>
      <Skeleton loading>
        <Text aria-hidden size="4">
          {t("payments.details.loading")}
        </Text>
      </Skeleton>
    </Flex>
  )
}

function toPayment(payment: PaymentDetails): Payment {
  return {
    id: payment.id,
    categoryId: payment.category?.id ?? null,
    note: payment.note,
    amount: payment.amount,
    date: payment.date,
    bookId: payment.bookId,
    createdDate: payment.createdDate,
    updatedDate: payment.updatedDate,
  }
}
