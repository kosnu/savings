import { Button, Dialog } from "@radix-ui/themes"
import { useCallback } from "react"
import { useDialog } from "../../../../utils/useDialog"
import { CreatePaymentForm } from "../CreatePaymentForm"

interface CreatePaymentModalProps {
  onSuccess?: () => void
}

export function CreatePaymentModal({ onSuccess }: CreatePaymentModalProps) {
  const { open, openDialog, closeDialog } = useDialog()

  const handleSuccess = useCallback(() => {
    onSuccess?.()
    closeDialog()
  }, [onSuccess, closeDialog])

  const handleError = useCallback((error?: Error) => {
    console.error("Error creating payment:", error)
  }, [])

  const handleCancel = useCallback(() => {
    closeDialog()
  }, [closeDialog])

  return (
    <Dialog.Root open={open}>
      <Button onClick={openDialog}>Create payment</Button>
      <Dialog.Content>
        <Dialog.Title>Create payment</Dialog.Title>
        <Dialog.Description size="2" mb="4">
          Create a new payment. Please fill in the details below.
        </Dialog.Description>
        <CreatePaymentForm
          onSuccess={handleSuccess}
          onError={handleError}
          onCancel={handleCancel}
        />
      </Dialog.Content>
    </Dialog.Root>
  )
}
