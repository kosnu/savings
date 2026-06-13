import { TrashIcon } from "@radix-ui/react-icons"
import { Button, Dialog, Flex, Text } from "@radix-ui/themes"
import { useCallback, type ReactElement } from "react"

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
  const categoryName = category?.name ?? "Category not found."
  const triggerAriaLabel = category ? `Delete ${category.name} category` : "Delete category"
  const resolvedTrigger = trigger ?? (
    <Button aria-label={triggerAriaLabel} color="red" size="1" variant="ghost">
      <TrashIcon aria-hidden />
      Delete
    </Button>
  )

  const handleSubmit = useCallback(async () => {
    if (!category) return

    try {
      await deleteCategory(category.id)
      openSnackbar("success", "Category deleted successfully.")
      closeDialog()
    } catch {
      openSnackbar("error", "Failed to delete category.")
    }
  }, [category, closeDialog, deleteCategory, openSnackbar])

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger>{resolvedTrigger}</Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Title>Delete this category and its budget?</Dialog.Title>
        <Dialog.Description>
          Payments using this category will become uncategorized.
        </Dialog.Description>
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
            Delete
          </SubmitButton>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}
