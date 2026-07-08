import { TrashIcon } from "@radix-ui/react-icons"
import { Button, Dialog, Flex, Text } from "@radix-ui/themes"
import { useCallback, type ReactElement } from "react"
import { useTranslation } from "react-i18next"

import { CancelButton } from "../../../../components/buttons/CancelButton"
import { SubmitButton } from "../../../../components/buttons/SubmitButton"
import { useSnackbar } from "../../../../providers/snackbar/SnackbarProvider"
import { useDialog } from "../../../../utils/useDialog"
import { useDeleteCategory } from "../useDeleteCategory"

interface DeleteCategoryModalProps {
  category?: {
    id: number
    name: string
  } | null
  trigger?: ReactElement
}

export function DeleteCategoryModal({ category, trigger }: DeleteCategoryModalProps) {
  const { open, closeDialog, onOpenChange } = useDialog()
  const { openSnackbar } = useSnackbar()
  const { deleteCategory, isPending } = useDeleteCategory()
  const { t } = useTranslation()
  const categoryName = category?.name ?? t("categories.notFound")
  const triggerAriaLabel = category
    ? t("categories.deleteAria", { name: category.name })
    : t("categories.deleteAriaFallback")
  const resolvedTrigger = trigger ?? (
    <Button aria-label={triggerAriaLabel} color="red" size="1" variant="ghost">
      <TrashIcon aria-hidden />
      {t("categories.delete")}
    </Button>
  )

  const handleSubmit = useCallback(async () => {
    if (!category) return

    try {
      await deleteCategory(category.id)
      openSnackbar("success", t("categories.deleteSuccess"))
      closeDialog()
    } catch {
      openSnackbar("error", t("categories.deleteFailed"))
    }
  }, [category, closeDialog, deleteCategory, openSnackbar, t])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger>{resolvedTrigger}</Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Title>{t("categories.deleteTitle")}</Dialog.Title>
        <Dialog.Description>{t("categories.deleteDescription")}</Dialog.Description>
        <Text as="p" mt="2" weight="medium">
          {categoryName}
        </Text>
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close>
            <CancelButton disabled={isPending} />
          </Dialog.Close>
          <SubmitButton
            type="button"
            color="red"
            loading={isPending}
            disabled={!category}
            onClick={handleSubmit}
          >
            {t("common.delete")}
          </SubmitButton>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
