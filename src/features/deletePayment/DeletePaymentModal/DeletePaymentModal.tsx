import { Button, Dialog, Flex } from "@radix-ui/themes"
import { useCallback } from "react"
import { CancelButton } from "../../../components/buttons/CancelButton"
import type { Payment } from "../../../types/payment"
import { formatDateToLocaleString } from "../../../utils/formatter/formatDateToLocaleString"
import { toCurrency } from "../../../utils/toCurrency"

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
  const paymentInfo = `${formatDateToLocaleString(payment.date)} ${payment.title} ${toCurrency(payment.price)}`

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose?.()
      }
    },
    [onClose],
  )

  // TODO: あとで削除処理を実行するように実装する
  const handleSubmit = useCallback(() => {
    try {
      console.debug("Payment deleted successfully.")
    } catch (error) {
      console.error("Failed to delete payment.")
    }
  }, [])

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
            <Button color="red" onClick={handleSubmit}>
              Delete
            </Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
