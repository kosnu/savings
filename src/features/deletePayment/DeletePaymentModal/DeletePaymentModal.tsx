import { Button, Dialog, Flex } from "@radix-ui/themes"
import { useCallback } from "react"
import { CancelButton } from "../../../components/buttons/CancelButton"
import type { Payment } from "../../../types/payment"
import { formatDateToLocaleString } from "../../../utils/formatter/formatDateToLocaleString"
import { toCurrency } from "../../../utils/toCurrency"
import { useSnackbar } from "../../../utils/useSnackbar"
import { useDeletePayment } from "../useDeletePayment"

interface DeletePaymentModalProps {
  payment: Payment
  open?: boolean
  onClose?: () => void
}

export function DeletePaymentModal({
  payment,
  open,
  onClose,
}: DeletePaymentModalProps) {
  const { deletePayment } = useDeletePayment()
  const { openSnackbar: openSuccessSnackbar, Snackbar: SuccessSnackbar } =
    useSnackbar("success")
  const { openSnackbar: openErrorSnackbar, Snackbar: ErrorSnackbar } =
    useSnackbar("error")
  const paymentInfo = `${formatDateToLocaleString(payment.date)} ${payment.note} ${toCurrency(payment.amount)}`

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose?.()
      }
    },
    [onClose],
  )

  const handleSubmit = useCallback(() => {
    try {
      deletePayment(payment)
      openSuccessSnackbar("Payment deleted successfully.")
    } catch (_error) {
      openErrorSnackbar("Failed to delete payment.")
    }
  }, [deletePayment, payment, openSuccessSnackbar, openErrorSnackbar])

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
      <SuccessSnackbar />
      <ErrorSnackbar />
    </>
  )
}
