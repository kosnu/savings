import { Flex } from "@radix-ui/themes"
import { memo, Suspense, use } from "react"
import { PaymentCard } from "../../../../components/payments/PaymentCard/PaymentCard"
import type { Category } from "../../../../types/category"
import type { Payment } from "../../../../types/payment"
import {
  getCategoryStrict,
  toCategoryMap,
} from "../../../categories/listCategory/toCategoryMap"
import { useCategories } from "../../../categories/listCategory/useCategories"
import { PaymentItem } from "../PaymentItem"
import { usePayments } from "../usePayments"

interface PaymentListProps {
  onDeleteSuccess: () => void
}

export const PaymentList = memo(function PaymentList({
  onDeleteSuccess,
}: PaymentListProps) {
  const { promise: promisePayments } = usePayments()
  const { promise: promiseCategories } = useCategories()

  return (
    <Flex aria-label="payment-list" direction="column" gap="2">
      <Suspense fallback={<SkeltonItems />}>
        <Items
          promiseCategories={promiseCategories}
          getPayments={promisePayments}
          onDeleteSuccess={onDeleteSuccess}
        />
      </Suspense>
    </Flex>
  )
})

interface ItemsProps {
  promiseCategories: Promise<Category[]>
  getPayments: Promise<Payment[]>
  onDeleteSuccess: () => void
}

const Items = memo(function Body({
  promiseCategories,
  getPayments,
  onDeleteSuccess,
}: ItemsProps) {
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
            onDeleteSuccess={onDeleteSuccess}
          />
        )
      })}
    </>
  )
})

function SkeltonItems() {
  return (
    <>
      <PaymentCard loading />
      <PaymentCard loading />
      <PaymentCard loading />
    </>
  )
}
