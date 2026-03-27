import { Dialog, Flex } from "@radix-ui/themes"
import { useCallback } from "react"

import { CancelButton } from "../../../../components/buttons/CancelButton"
import { SubmitButton } from "../../../../components/buttons/SubmitButton"
import { useSnackbar } from "../../../../providers/snackbar"
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
  const paymentInfo = payment
    ? `${formatDateToLocaleString(payment.date)} ${payment.note} ${toCurrency(payment.amount)}`
    : "Payment not found."

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
      openSnackbar("success", "Payment deleted successfully.")
      onSuccess()
      onClose?.()
    } catch {
      openSnackbar("error", "Failed to delete payment.")
    }
  }, [deletePayment, onClose, onSuccess, openSnackbar, payment])

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Content>
        <Dialog.Title>Delete this payment?</Dialog.Title>
        <Dialog.Description>{paymentInfo}</Dialog.Description>
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <CancelButton disabled={isPending} />
          </Dialog.Close>
          <SubmitButton
            type="button"
            color="red"
            loading={isPending}
            disabled={!payment}
            onClick={handleSubmit}
          >
            Delete
          </SubmitButton>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
