import { Pencil1Icon } from "@radix-ui/react-icons"
import { Button } from "@radix-ui/themes"
import { useCallback, type ReactElement } from "react"

import { ResponsiveOverlay } from "../../../../components/overlay/ResponsiveOverlay"
import { useDialog } from "../../../../utils/useDialog"
import { UpdateCategoryNameForm } from "../UpdateCategoryNameForm"

interface UpdateCategoryNameModalProps {
  category: {
    id: number
    name: string
  }
  trigger?: ReactElement
}

export function UpdateCategoryNameModal({
  category,
  trigger = (
    <Button aria-label={`Edit ${category.name} category name`} size="1" variant="ghost">
      <Pencil1Icon aria-hidden />
      Edit
    </Button>
  ),
}: UpdateCategoryNameModalProps) {
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
      title="Edit category"
      description="Update the category name."
    >
      <UpdateCategoryNameForm
        category={category}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </ResponsiveOverlay>
  )
}
