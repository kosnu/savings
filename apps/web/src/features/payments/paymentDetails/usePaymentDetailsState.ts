import { useCallback, useRef, useState } from "react"

import type { PaymentId } from "../../../types/payment"

export function usePaymentDetailsState() {
  const [selectedPaymentId, setSelectedPaymentId] = useState<PaymentId | null>(null)
  const lastOpenedTriggerRef = useRef<HTMLButtonElement | null>(null)

  const openPaymentDetails = useCallback((paymentId: PaymentId, trigger: HTMLButtonElement) => {
    lastOpenedTriggerRef.current = trigger
    setSelectedPaymentId(paymentId)
  }, [])

  const closePaymentDetails = useCallback(() => {
    setSelectedPaymentId(null)
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
    selectedPaymentId,
    openPaymentDetails,
    closePaymentDetails,
    onOpenChange,
  }
}
