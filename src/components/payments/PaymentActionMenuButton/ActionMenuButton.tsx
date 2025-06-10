import { DotsVerticalIcon } from "@radix-ui/react-icons"
import { DropdownMenu, IconButton } from "@radix-ui/themes"
import { useCallback } from "react"
import { useDeletePaymentModal } from "../../../features/deletePayment"
import type { Payment } from "../../../types/payment"

interface ActionMenuButtonProps {
  payment: Payment
}

export function ActionMenuButton({ payment }: ActionMenuButtonProps) {
  const { open: openDeleteModal, DeletePaymentModal } = useDeletePaymentModal()

  const handleDeleteClick = useCallback(() => {
    openDeleteModal(payment)
  }, [openDeleteModal, payment])

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <IconButton variant="outline">
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
      <DeletePaymentModal />
    </>
  )
}
