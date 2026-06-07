import { Button, Flex, Text } from "@radix-ui/themes"
import { useNavigate } from "@tanstack/react-router"
import { memo, Suspense, use, useCallback, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"

import type { Payment, PaymentId } from "../../../../types/payment"
import { unknownCategory } from "../../../categories"
import { DeletePaymentModal } from "../../deletePayment/DeletePaymentModal"
import { PaymentDetailsOverlay } from "../../paymentDetails/PaymentDetailsOverlay"
import { usePaymentDetailsState } from "../../paymentDetails/usePaymentDetailsState"
import { PaymentCard } from "../PaymentCard"
import { PaymentItem } from "../PaymentItem"
import { useCategoryId } from "../useCategoryId"
import { usePayments } from "../usePayments"

interface PaymentListProps {
  cacheScope?: string
}

export const PaymentList = memo(function PaymentList({ cacheScope }: PaymentListProps) {
  const categoryId = useCategoryId()
  const navigate = useNavigate({ from: "/payments" })
  const { promise: promisePayments } = usePayments({ cacheScope, categoryId })
  const {
    hasPaymentDetailsRoute,
    selectedPaymentId,
    openPaymentDetails,
    closePaymentDetails,
    onOpenChange,
  } = usePaymentDetailsState()
  const [paymentPendingDelete, setPaymentPendingDelete] = useState<Payment | null>(null)

  const handleDeleteIntent = useCallback((payment: Payment) => {
    setPaymentPendingDelete(payment)
  }, [])

  const handleDeleteClose = useCallback(() => {
    setPaymentPendingDelete(null)
  }, [])

  const handleDeleteSuccess = useCallback(() => {
    setPaymentPendingDelete(null)
    closePaymentDetails()
  }, [closePaymentDetails])

  const handleClearCategory = useCallback(() => {
    void navigate({
      to: "/payments",
      search: (prev) => ({ ...prev, category: undefined }),
    })
  }, [navigate])

  return (
    <>
      <Flex aria-label="payment-list" direction="column" gap="2" tabIndex={-1}>
        <ErrorBoundary fallback={<PaymentListError />} resetKeys={[promisePayments]}>
          <Suspense fallback={<SkeltonItems />}>
            <Items
              getPayments={promisePayments}
              onOpenPayment={openPaymentDetails}
              filtered={categoryId !== undefined}
              onClearCategory={handleClearCategory}
            />
          </Suspense>
        </ErrorBoundary>
      </Flex>
      <PaymentDetailsOverlay
        open={hasPaymentDetailsRoute}
        paymentId={selectedPaymentId}
        onOpenChange={onOpenChange}
        onDelete={handleDeleteIntent}
      />
      <DeletePaymentModal
        open={paymentPendingDelete !== null}
        payment={paymentPendingDelete}
        onClose={handleDeleteClose}
        onSuccess={handleDeleteSuccess}
      />
    </>
  )
})

interface ItemsProps {
  getPayments: Promise<Payment[]>
  onOpenPayment: (paymentId: PaymentId, trigger: HTMLButtonElement) => void
  filtered: boolean
  onClearCategory: () => void
}

const Items = memo(function Body({
  getPayments,
  onOpenPayment,
  filtered,
  onClearCategory,
}: ItemsProps) {
  const data = use(getPayments)

  if (data.length === 0) {
    return <EmptyItems filtered={filtered} onClearCategory={onClearCategory} />
  }

  return (
    <>
      {data.map((payment) => {
        if (payment.id === undefined) {
          return null
        }
        const paymentId = payment.id
        const category = payment.category ?? unknownCategory

        return (
          <PaymentItem
            key={paymentId}
            category={category}
            payment={payment}
            onOpen={(trigger) => onOpenPayment(paymentId, trigger)}
          />
        )
      })}
    </>
  )
})

function EmptyItems({
  filtered,
  onClearCategory,
}: {
  filtered: boolean
  onClearCategory: () => void
}) {
  return (
    <Flex align="start" direction="column" gap="2">
      <Text color="gray">No payments found.</Text>
      {filtered ? (
        <Button variant="soft" onClick={onClearCategory}>
          Clear filter
        </Button>
      ) : null}
    </Flex>
  )
}

function SkeltonItems() {
  return (
    <>
      <PaymentCard loading interactive />
      <PaymentCard loading interactive />
      <PaymentCard loading interactive />
    </>
  )
}

function PaymentListError() {
  return (
    <Text color="red" role="alert">
      Could not load payments.
    </Text>
  )
}
