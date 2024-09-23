import { type ReactElement, useCallback, useState } from "react"
import { CreatePaymentModal as CreatePaymentModalComponent } from "./CreatePaymentModal"

interface UseCreatePaymentReturn {
  open: () => void
  CreatePaymentModal: () => ReactElement
}

export function useCreatePayment(): UseCreatePaymentReturn {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => {
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
  }, [])

  const CreatePaymentModal = useCallback(() => {
    return <CreatePaymentModalComponent open={isOpen} onClose={close} />
  }, [isOpen, close])

  return {
    open: open,
    CreatePaymentModal: CreatePaymentModal,
  }
}
