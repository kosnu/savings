import { Button, Dialog, Flex } from "@radix-ui/themes"
import { useCallback } from "react"
import { CancelButton } from "../../../../components/buttons/CancelButton"
import { useSnackbar } from "../../../../providers/snackbar"
import type { Payment } from "../../../../types/payment"
import { formatDateToLocaleString } from "../../../../utils/formatter/formatDateToLocaleString"
import { toCurrency } from "../../../../utils/toCurrency"
import { useDeletePayment } from "../useDeletePayment"

interface DeletePaymentModalProps {
  payment?: Payment | null
  open?: boolean
  onClose?: () => void
  onSuccess: () => void
}

export function DeletePaymentModal({
  payment,
  open,
  onClose,
  onSuccess,
}: DeletePaymentModalProps) {
  const { deletePayment } = useDeletePayment()
  const { openSnackbar } = useSnackbar()
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
    if (!payment) return

    try {
      await deletePayment(payment)
      openSnackbar("success", "Payment deleted successfully.")
      onSuccess()
    } catch (_error) {
      openSnackbar("error", "Failed to delete payment.")
    }
  }, [deletePayment, payment, onSuccess, openSnackbar])

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      {open === undefined && (
        <Dialog.Trigger>
          <Button>Delete payment</Button>
        </Dialog.Trigger>
      )}
      <Dialog.Content>
        <Dialog.Title>Delete this payment?</Dialog.Title>
        <Dialog.Description>{paymentInfo}</Dialog.Description>
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <CancelButton />
          </Dialog.Close>
          <Dialog.Close>
            <Button color="red" disabled={!payment} onClick={handleSubmit}>
              Delete
            </Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
