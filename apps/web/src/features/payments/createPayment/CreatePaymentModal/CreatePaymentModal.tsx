import { Button } from "@radix-ui/themes"
import { useCallback, useRef, useState } from "react"

import { ResponsiveOverlay } from "../../../../components/overlay/ResponsiveOverlay"
import { useDialog } from "../../../../utils/useDialog"
import { CreatePaymentForm } from "../CreatePaymentForm"

interface CreatePaymentModalProps {
  onSuccess?: () => void
}

export function CreatePaymentModal({ onSuccess }: CreatePaymentModalProps) {
  const { open, closeDialog, onOpenChange } = useDialog()
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
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      trigger={<Button>Create payment</Button>}
      title="Create payment"
      description="Create a new payment. Please fill in the details below."
    >
      <CreatePaymentForm
        onSuccess={handleSuccess}
        onError={handleError}
        onCancel={handleCancel}
        onResetReady={handleResetReady}
        continuousMode={continuousMode}
        onContinuousModeChange={setContinuousMode}
      />
    </ResponsiveOverlay>
  )
}
