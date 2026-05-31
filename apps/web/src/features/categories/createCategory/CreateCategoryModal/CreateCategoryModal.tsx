import { PlusIcon } from "@radix-ui/react-icons"
import { Button } from "@radix-ui/themes"
import { useCallback, type ReactElement } from "react"

import { ResponsiveOverlay } from "../../../../components/overlay/ResponsiveOverlay"
import { useDialog } from "../../../../utils/useDialog"
import { CreateCategoryForm } from "../CreateCategoryForm"

interface CreateCategoryModalProps {
  currentPinnedCount?: number
  trigger?: ReactElement
}

export function CreateCategoryModal({
  currentPinnedCount = 0,
  trigger = (
    <Button size="2" variant="soft">
      <PlusIcon aria-hidden />
      Create category
    </Button>
  ),
}: CreateCategoryModalProps) {
  const { open, closeDialog, onOpenChange } = useDialog()

  const handleSuccess = useCallback(() => {
    closeDialog()
  }, [closeDialog])

  const handleCancel = useCallback(() => {
    closeDialog()
  }, [closeDialog])

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      dismissible={false}
      trigger={trigger}
      title="Create category"
      description="Create a category."
    >
      <CreateCategoryForm
        currentPinnedCount={currentPinnedCount}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </ResponsiveOverlay>
  )
}
