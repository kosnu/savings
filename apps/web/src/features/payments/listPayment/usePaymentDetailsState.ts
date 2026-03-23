import { useCallback, useRef, useState } from "react"

import type { Category } from "../../../types/category"
import type { Payment } from "../../../types/payment"

interface SelectedPayment {
  category: Category
  payment: Payment
}

export function usePaymentDetailsState() {
  const [selectedPayment, setSelectedPayment] = useState<SelectedPayment | null>(null)
  const lastOpenedTriggerRef = useRef<HTMLButtonElement | null>(null)

  const openPaymentDetails = useCallback(
    (payment: Payment, category: Category, trigger: HTMLButtonElement) => {
      lastOpenedTriggerRef.current = trigger
      setSelectedPayment({ payment, category })
    },
    [],
  )

  const closePaymentDetails = useCallback(() => {
    setSelectedPayment(null)
    requestAnimationFrame(() => {
      lastOpenedTriggerRef.current?.focus()
    })
  }, [])

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (open) return
      closePaymentDetails()
    },
    [closePaymentDetails],
  )

  return {
    selectedPayment,
    openPaymentDetails,
    closePaymentDetails,
    onOpenChange,
  }
}
