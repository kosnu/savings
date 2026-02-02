import { Button, Checkbox, Dialog, Flex, Text } from "@radix-ui/themes"
import { useCallback, useId, useRef, useState } from "react"
import { useDialog } from "../../../../utils/useDialog"
import { CreatePaymentForm } from "../CreatePaymentForm"

interface CreatePaymentModalProps {
  onSuccess?: () => void
}

export function CreatePaymentModal({ onSuccess }: CreatePaymentModalProps) {
  const { open, openDialog, closeDialog } = useDialog()
  const checkboxId = useId()
  const [continuousMode, setContinuousMode] = useState(false)
  const formResetRef = useRef<(() => void) | null>(null)

  const handleResetReady = useCallback((resetFn: () => void) => {
    formResetRef.current = resetFn
  }, [])

  const handleSuccess = useCallback(() => {
    onSuccess?.()

    if (continuousMode) {
      // Reset the form for continuous creation
      formResetRef.current?.()
    } else {
      // Close the dialog (existing behavior)
      closeDialog()
    }
  }, [continuousMode, onSuccess, closeDialog])

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
          onResetReady={handleResetReady}
        />
        <Flex gap="3" mt="3" justify="start">
          <Text as="label" size="2" htmlFor={checkboxId}>
            <Flex gap="2" align="center">
              <Checkbox
                id={checkboxId}
                checked={continuousMode}
                onCheckedChange={(checked) =>
                  setContinuousMode(checked === true)
                }
              />
              Continue creating
            </Flex>
          </Text>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
