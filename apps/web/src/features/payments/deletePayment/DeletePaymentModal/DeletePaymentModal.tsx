import { Dialog, Flex } from "@radix-ui/themes"
import { useCallback } from "react"
import { useTranslation } from "react-i18next"

import { CancelButton } from "../../../../components/buttons/CancelButton"
import { SubmitButton } from "../../../../components/buttons/SubmitButton"
import { getDateFormat } from "../../../../i18n"
import { useSnackbar } from "../../../../providers/snackbar/SnackbarProvider"
import type { Payment } from "../../../../types/payment"
import { formatDateToLocaleString } from "../../../../utils/formatter/formatDateToLocaleString"
import { toCurrency } from "../../../../utils/toCurrency"
import { useDeletePayment } from "../useDeletePayment"

interface DeletePaymentModalProps {
  payment?: Payment | null
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function DeletePaymentModal({ payment, open, onClose, onSuccess }: DeletePaymentModalProps) {
  const { openSnackbar } = useSnackbar()
  const { deletePayment, isPending } = useDeletePayment()
  const { i18n, t } = useTranslation()
  const paymentInfo = payment
    ? `${formatDateToLocaleString(payment.date, getDateFormat(i18n.resolvedLanguage), i18n.resolvedLanguage)} ${payment.note} ${toCurrency(payment.amount)}`
    : t("payments.details.notFound")

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose?.()
      }
    },
    [onClose],
  )

  const handleSubmit = useCallback(async () => {
    if (!payment?.id) return
    try {
      await deletePayment(payment.id)
      openSnackbar("success", t("payments.delete.success"))
      onSuccess()
      onClose?.()
    } catch {
      openSnackbar("error", t("payments.delete.failed"))
    }
  }, [deletePayment, onClose, onSuccess, openSnackbar, payment, t])

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Content>
        <Dialog.Title>{t("payments.delete.title")}</Dialog.Title>
        <Dialog.Description>{paymentInfo}</Dialog.Description>
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <CancelButton disabled={isPending} />
          </Dialog.Close>
          <SubmitButton
            type="button"
            color="red"
            loading={isPending}
            disabled={!payment?.id}
            onClick={handleSubmit}
          >
            {t("common.delete")}
          </SubmitButton>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
