import { Button } from "@radix-ui/themes"
import { useCallback, type ReactElement } from "react"

import { ResponsiveOverlay } from "../../../../components/overlay/ResponsiveOverlay"
import { captureCategoryBudgetCreateError } from "../../../../lib/sentry"
import { useDialog } from "../../../../utils/useDialog"
import { CreateCategoryBudgetForm } from "../CreateCategoryBudgetForm"

interface CreateCategoryBudgetModalProps {
  trigger?: ReactElement
}

export function CreateCategoryBudgetModal({
  trigger = <Button>Create category budget</Button>,
}: CreateCategoryBudgetModalProps) {
  const { open, closeDialog, onOpenChange } = useDialog()

  const handleSuccess = useCallback(() => {
    closeDialog()
  }, [closeDialog])

  const handleError = useCallback((error: unknown) => {
    captureCategoryBudgetCreateError(error)
  }, [])

  const handleCancel = useCallback(() => {
    closeDialog()
  }, [closeDialog])

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      dismissible={false}
      trigger={trigger}
      title="Create category budget"
      description="Set a category budget amount."
    >
      <CreateCategoryBudgetForm
        onSuccess={handleSuccess}
        onError={handleError}
        onCancel={handleCancel}
      />
    </ResponsiveOverlay>
  )
}
