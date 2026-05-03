import { useNavigate, useParams, useRouter } from "@tanstack/react-router"
import { useCallback, useRef } from "react"

import type { PaymentId } from "../../../types/payment"

export function usePaymentDetailsState() {
  const { hasPaymentDetailsRoute, selectedPaymentId } = useSelectedPaymentDetails()
  const navigate = useNavigate({ from: "/payments" })
  const router = useRouter()
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
    const openedTrigger = lastOpenedTriggerRef.current
    lastOpenedTriggerRef.current = null

    if (openedTrigger) {
      router.history.back()
    } else {
      void navigate({
        to: "/payments",
        search: (prev) => prev,
        replace: true,
      })
    }

    requestAnimationFrame(() => {
      openedTrigger?.focus()
    })
  }, [navigate, router])

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (open) return
      closePaymentDetails()
    },
    [closePaymentDetails],
  )

  return {
    hasPaymentDetailsRoute,
    selectedPaymentId,
    openPaymentDetails,
    closePaymentDetails,
    onOpenChange,
  }
}

function useSelectedPaymentDetails(): {
  hasPaymentDetailsRoute: boolean
  selectedPaymentId: PaymentId | null
} {
  const paymentIdParam = useParams({
    strict: false,
    select: (params) => params.paymentId,
  })
  const hasPaymentDetailsRoute = paymentIdParam !== undefined

  return {
    hasPaymentDetailsRoute,
    selectedPaymentId: hasPaymentDetailsRoute ? toPaymentId(paymentIdParam) : null,
  }
}

function toPaymentId(paymentIdParam: string | undefined): PaymentId | null {
  const paymentId = Number(paymentIdParam)

  if (Number.isSafeInteger(paymentId) && paymentId > 0) {
    return paymentId
  }

  return null
}
