import { Button, Dialog, Flex } from "@radix-ui/themes"
import { useCallback } from "react"
import { CancelButton } from "../../../components/buttons/CancelButton"
import { useSnackbar } from "../../../shared/snackbar"
import type { Payment } from "../../../types/payment"
import { formatDateToLocaleString } from "../../../utils/formatter/formatDateToLocaleString"
import { toCurrency } from "../../../utils/toCurrency"
import { useDeletePayment } from "../useDeletePayment"

interface DeletePaymentModalProps {
  payment: Payment
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
  const paymentInfo = `${formatDateToLocaleString(payment.date)} ${payment.note} ${toCurrency(payment.amount)}`

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose?.()
      }
    },
    [onClose],
  )

  const handleSubmit = useCallback(async () => {
    try {
      await deletePayment(payment)
      openSnackbar("success", "Payment deleted successfully.")
      onSuccess()
    } catch (_error) {
      openSnackbar("error", "Failed to delete payment.")
    }
  }, [deletePayment, payment, onSuccess, openSnackbar])

  return (
    <>
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
              <Button color="red" onClick={handleSubmit}>
                Delete
              </Button>
            </Dialog.Close>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </>
  )
}
