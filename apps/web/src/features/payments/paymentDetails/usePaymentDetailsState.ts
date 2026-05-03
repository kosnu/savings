import { useNavigate, useParams } from "@tanstack/react-router"
import { useCallback, useRef } from "react"

import type { PaymentId } from "../../../types/payment"

export function usePaymentDetailsState() {
  const selectedPaymentId = useSelectedPaymentId()
  const navigate = useNavigate({ from: "/payments" })
  const lastOpenedTriggerRef = useRef<HTMLButtonElement | null>(null)

  const openPaymentDetails = useCallback(
    (paymentId: PaymentId, trigger: HTMLButtonElement) => {
      lastOpenedTriggerRef.current = trigger
      void navigate({
        to: "/payments/details/$paymentId",
        params: { paymentId: String(paymentId) },
        search: (prev) => prev,
      })
    },
    [navigate],
  )

  const closePaymentDetails = useCallback(() => {
    void navigate({
      to: "/payments",
      search: (prev) => prev,
      replace: true,
    })
    requestAnimationFrame(() => {
      lastOpenedTriggerRef.current?.focus()
    })
  }, [navigate])

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

function useSelectedPaymentId(): PaymentId | null {
  const paymentIdParam = useParams({
    strict: false,
    select: (params) => params.paymentId,
  })

  if (paymentIdParam === undefined) {
    return null
  }

  return toPaymentId(paymentIdParam)
}

function toPaymentId(paymentIdParam: string): PaymentId {
  const paymentId = Number(paymentIdParam)

  if (Number.isSafeInteger(paymentId) && paymentId > 0) {
    return paymentId
  }

  return 0
}
