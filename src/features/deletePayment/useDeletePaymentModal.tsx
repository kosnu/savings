import { Fragment, type JSX, useCallback, useState } from "react"
import type { Payment } from "../../types/payment"
import { useDialog } from "../../utils/useDialog"
import { DeletePaymentModal } from "./DeletePaymentModal"

interface UseDeletePaymentModalReturn {
  open: (payment: Payment) => void
  DeletePaymentModal: () => JSX.Element
}

export function useDeletePaymentModal(): UseDeletePaymentModalReturn {
  const { open, openDialog, closeDialog } = useDialog()
  const [payment, setPayment] = useState<Payment | null>(null)

  const openDeleteModal = useCallback(
    (payment: Payment) => {
      openDialog()
      setPayment(payment)
    },
    [openDialog],
  )

  const DeletePaymentModalComponent = useCallback(() => {
    if (!payment) return <Fragment />

    return (
      <DeletePaymentModal open={open} payment={payment} onClose={closeDialog} />
    )
  }, [open, closeDialog, payment])

  return {
    open: openDeleteModal,
    DeletePaymentModal: DeletePaymentModalComponent,
  }
}
