import { DotsVerticalIcon } from "@radix-ui/react-icons"
import { DropdownMenu, IconButton } from "@radix-ui/themes"
import { useCallback } from "react"
import { useDeletePaymentModal } from "../../../features/payments/deletePayment"
import type { Payment } from "../../../types/payment"

interface ActionMenuButtonProps {
  payment: Payment
  onDeleteSuccess: () => void
}

export function ActionMenuButton({
  payment,
  onDeleteSuccess,
}: ActionMenuButtonProps) {
  const { open: openDeleteModal, DeletePaymentModal } = useDeletePaymentModal()

  const handleDeleteClick = useCallback(() => {
    openDeleteModal(payment)
  }, [openDeleteModal, payment])

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <IconButton aria-label="Payment actions" variant="outline">
            <DotsVerticalIcon />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content aria-label="Payment actions">
          {/* <DropdownMenu.Item>Edit</DropdownMenu.Item> */}
          <DropdownMenu.Item color="red" onClick={handleDeleteClick}>
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <DeletePaymentModal onSuccess={onDeleteSuccess} />
    </>
  )
}
