import { Button } from "@radix-ui/themes"
import { type ComponentRef, type ReactElement, useCallback, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { ResponsiveOverlay } from "../../../../components/overlay/ResponsiveOverlay"
import { useDialog } from "../../../../utils/useDialog"
import { CreatePaymentForm } from "../CreatePaymentForm"

interface CreatePaymentModalProps {
  bookId: number
  onSuccess?: () => void
  trigger?: ReactElement
}

export function CreatePaymentModal({ bookId, onSuccess, trigger }: CreatePaymentModalProps) {
  const { open, closeDialog, onOpenChange } = useDialog()
  const { t } = useTranslation()
  const [continuousMode, setContinuousMode] = useState(false)
  const formRef = useRef<ComponentRef<typeof CreatePaymentForm>>(null)

  const handleSuccess = useCallback(() => {
    onSuccess?.()

    if (continuousMode) {
      // Reset the form for continuous creation
      formRef.current?.reset()
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
      dismissible={false}
      onEscapeKeyDown={(event) => {
        if (!event.defaultPrevented && formRef.current?.canCloseOnEscape()) {
          closeDialog()
        }
      }}
      trigger={trigger ?? <Button>{t("payments.create.trigger")}</Button>}
      title={t("payments.create.title")}
      description={t("payments.create.description")}
    >
      <CreatePaymentForm
        ref={formRef}
        bookId={bookId}
        onSuccess={handleSuccess}
        onError={handleError}
        onCancel={handleCancel}
        continuousMode={continuousMode}
        onContinuousModeChange={setContinuousMode}
      />
    </ResponsiveOverlay>
  )
}
