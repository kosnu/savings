import { Flex } from "@radix-ui/themes"
import { memo, Suspense, use } from "react"

import { PaymentCard } from "../../../../components/payments/PaymentCard/PaymentCard"
import type { Category } from "../../../../types/category"
import type { Payment } from "../../../../types/payment"
import { getCategoryStrict, toCategoryMap } from "../../../categories/listCategory/toCategoryMap"
import { useCategories } from "../../../categories/listCategory/useCategories"
import { PaymentDetailsOverlay } from "../PaymentDetailsOverlay"
import { PaymentItem } from "../PaymentItem"
import { usePaymentDetailsState } from "../usePaymentDetailsState"
import { usePayments } from "../usePayments"

export const PaymentList = memo(function PaymentList() {
  const { promise: promisePayments } = usePayments()
  const { promise: promiseCategories } = useCategories()
  const { selectedPayment, openPaymentDetails, onOpenChange } = usePaymentDetailsState()

  return (
    <>
      <Flex aria-label="payment-list" direction="column" gap="2" tabIndex={-1}>
        <Suspense fallback={<SkeltonItems />}>
          <Items
            promiseCategories={promiseCategories}
            getPayments={promisePayments}
            onOpenPayment={openPaymentDetails}
          />
        </Suspense>
      </Flex>
      <PaymentDetailsOverlay
        open={selectedPayment !== null}
        payment={selectedPayment?.payment ?? null}
        category={selectedPayment?.category ?? null}
        onOpenChange={onOpenChange}
      />
    </>
  )
})

interface ItemsProps {
  promiseCategories: Promise<Category[]>
  getPayments: Promise<Payment[]>
  onOpenPayment: (payment: Payment, category: Category, trigger: HTMLButtonElement) => void
}

const Items = memo(function Body({ promiseCategories, getPayments, onOpenPayment }: ItemsProps) {
  const data = use(getPayments)
  const categories = use(promiseCategories)
  const categoryMap = toCategoryMap(categories)

  return (
    <>
      {data.map((payment) => {
        const category = getCategoryStrict(categoryMap, payment.categoryId)

        return (
          <PaymentItem
            key={payment.id}
            category={category}
            payment={payment}
            onOpen={(trigger) => onOpenPayment(payment, category, trigger)}
          />
        )
      })}
    </>
  )
})

function SkeltonItems() {
  return (
    <>
      <PaymentCard loading interactive />
      <PaymentCard loading interactive />
      <PaymentCard loading interactive />
    </>
  )
}
