import { Button, Flex, Text } from "@radix-ui/themes"
import { useNavigate } from "@tanstack/react-router"
import { memo, Suspense, useCallback, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { useTranslation } from "react-i18next"

import type { Payment, PaymentId } from "../../../../types/payment"
import { useDateRange } from "../../../../utils/useDateRange"
import { DeletePaymentModal } from "../../deletePayment/DeletePaymentModal"
import { PaymentDetailsOverlay } from "../../paymentDetails/PaymentDetailsOverlay"
import { usePaymentDetailsState } from "../../paymentDetails/usePaymentDetailsState"
import { PaymentCard } from "../PaymentCard"
import { PaymentItem } from "../PaymentItem"
import { useCategoryId } from "../useCategoryId"
import { usePayments } from "../usePayments"

interface PaymentListProps {
  bookId: number
  cacheScope?: string
}

const defaultPaymentListCacheScope = "default"

export const PaymentList = memo(function PaymentList({ bookId, cacheScope }: PaymentListProps) {
  const { t } = useTranslation()
  const categoryId = useCategoryId()
  const navigate = useNavigate({ from: "/payments" })
  const { date } = useDateRange()
  const normalizedCacheScope = cacheScope ?? defaultPaymentListCacheScope
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
      <Flex aria-label={t("payments.list.label")} direction="column" gap="2" tabIndex={-1}>
        {date ? (
          <ErrorBoundary
            fallback={<PaymentListError />}
            resetKeys={[bookId, normalizedCacheScope, date.toISOString(), categoryId]}
          >
            <Suspense fallback={<SkeltonItems />}>
              <Items
                bookId={bookId}
                cacheScope={normalizedCacheScope}
                categoryId={categoryId}
                onOpenPayment={openPaymentDetails}
                filtered={categoryId !== undefined}
                onClearCategory={handleClearCategory}
              />
            </Suspense>
          </ErrorBoundary>
        ) : (
          <SkeltonItems />
        )}
      </Flex>
      <PaymentDetailsOverlay
        bookId={bookId}
        open={hasPaymentDetailsRoute}
        paymentId={selectedPaymentId}
        onOpenChange={onOpenChange}
        onDelete={handleDeleteIntent}
      />
      <DeletePaymentModal
        bookId={bookId}
        open={paymentPendingDelete !== null}
        payment={paymentPendingDelete}
        onClose={handleDeleteClose}
        onSuccess={handleDeleteSuccess}
      />
    </>
  )
})

interface ItemsProps {
  bookId: number
  cacheScope: string
  categoryId?: number | null
  onOpenPayment: (paymentId: PaymentId, trigger: HTMLButtonElement) => void
  filtered: boolean
  onClearCategory: () => void
}

const Items = memo(function Body({
  bookId,
  cacheScope,
  categoryId,
  onOpenPayment,
  filtered,
  onClearCategory,
}: ItemsProps) {
  const { data } = usePayments(bookId, { cacheScope, categoryId })

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

        return (
          <PaymentItem
            key={paymentId}
            category={payment.category ?? null}
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
  const { t } = useTranslation()

  return (
    <Flex align="start" direction="column" gap="2">
      <Text color="gray">{t("payments.list.empty")}</Text>
      {filtered ? (
        <Button variant="soft" onClick={onClearCategory}>
          {t("payments.list.clearFilter")}
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
  const { t } = useTranslation()

  return (
    <Text color="red" role="alert">
      {t("payments.list.loadError")}
    </Text>
  )
}
