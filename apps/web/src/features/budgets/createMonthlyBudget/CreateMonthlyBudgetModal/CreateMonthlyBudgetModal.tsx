import { Button } from "@radix-ui/themes"
import { useCallback } from "react"

import { ResponsiveOverlay } from "../../../../components/overlay/ResponsiveOverlay"
import { captureMonthlyBudgetCreateError } from "../../../../lib/sentry"
import { useDialog } from "../../../../utils/useDialog"
import { CreateMonthlyBudgetForm } from "../CreateMonthlyBudgetForm"

export function CreateMonthlyBudgetModal() {
  const { open, closeDialog, onOpenChange } = useDialog()

  const handleSuccess = useCallback(() => {
    closeDialog()
  }, [closeDialog])

  const handleError = useCallback((error: unknown) => {
    captureMonthlyBudgetCreateError(error)
  }, [])

  const handleCancel = useCallback(() => {
    closeDialog()
  }, [closeDialog])

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      dismissible={false}
      trigger={<Button>Create budget</Button>}
      title="Create monthly budget"
      description="Set a monthly budget amount."
    >
      <CreateMonthlyBudgetForm
        onSuccess={handleSuccess}
        onError={handleError}
        onCancel={handleCancel}
      />
    </ResponsiveOverlay>
  )
}
