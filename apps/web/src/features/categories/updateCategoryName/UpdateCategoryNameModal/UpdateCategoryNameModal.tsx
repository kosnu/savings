import { Pencil1Icon } from "@radix-ui/react-icons"
import { Button } from "@radix-ui/themes"
import { useCallback, type ReactElement } from "react"
import { useTranslation } from "react-i18next"

import { ResponsiveOverlay } from "../../../../components/overlay/ResponsiveOverlay"
import { useDialog } from "../../../../utils/useDialog"
import { UpdateCategoryNameForm } from "../UpdateCategoryNameForm"

interface UpdateCategoryNameModalProps {
  category: {
    id: number
    name: string
    pinned: boolean
    budgetStatus?: "amount" | "none" | "unset"
    budgetAmount?: number | null
  }
  currentPinnedCount?: number
  trigger?: ReactElement
}

export function UpdateCategoryNameModal({
  category,
  currentPinnedCount = 0,
  trigger,
}: UpdateCategoryNameModalProps) {
  const { open, closeDialog, onOpenChange } = useDialog()
  const { t } = useTranslation()
  const resolvedTrigger = trigger ?? (
    <Button
      aria-label={t("categories.editNameAria", { name: category.name })}
      size="1"
      variant="ghost"
    >
      <Pencil1Icon aria-hidden />
      {t("categories.edit")}
    </Button>
  )

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
      trigger={resolvedTrigger}
      title={t("categories.editTitle")}
      description={t("categories.editDescription")}
    >
      <UpdateCategoryNameForm
        category={category}
        currentPinnedCount={currentPinnedCount}
        onSuccess={handleSuccess}
        onCancel={handleCancel}
      />
    </ResponsiveOverlay>
  )
}
