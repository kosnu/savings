import { type JSX, useCallback, useState } from "react"

import type { Payment } from "../../../types/payment"
import { useDialog } from "../../../utils/useDialog"
import { DeletePaymentModal } from "./DeletePaymentModal"

interface UseDeletePaymentModalReturn {
  open: (payment: Payment) => void
  DeletePaymentModal: ({ onSuccess }: { onSuccess: () => void }) => JSX.Element
}

export function useDeletePaymentModal(bookId: number): UseDeletePaymentModalReturn {
  const { open, openDialog, closeDialog } = useDialog()
  const [payment, setPayment] = useState<Payment | null>(null)

  const openDeleteModal = useCallback(
    (selectedPayment: Payment) => {
      openDialog()
      setPayment(selectedPayment)
    },
    [openDialog],
  )

  const DeletePaymentModalComponent = useCallback(
    ({ onSuccess }: { onSuccess: () => void }) => {
      return (
        <DeletePaymentModal
          bookId={bookId}
          open={open}
          payment={payment}
          onClose={closeDialog}
          onSuccess={onSuccess}
        />
      )
    },
    [bookId, open, closeDialog, payment],
  )

  return {
    open: openDeleteModal,
    DeletePaymentModal: DeletePaymentModalComponent,
  }
}
