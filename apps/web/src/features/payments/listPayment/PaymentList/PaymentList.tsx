import { Spinner, Table } from "@radix-ui/themes"
import { memo, Suspense, use, useMemo } from "react"
import type { Category } from "../../../../types/category"
import type { Payment } from "../../../../types/payment"
import { useDateRange } from "../../../../utils/useDateRange"
import {
  getCategoryStrict,
  toCategoryMap,
} from "../../../categories/listCategory/toCategoryMap"
import { useCategories } from "../../../categories/listCategory/useCategories"
import { PaymentItem } from "../PaymentItem"
import { useGetPayments } from "../useGetPayments"

interface PaymentListProps {
  onDeleteSuccess: () => void
}

export const PaymentList = memo(function PaymentList({
  onDeleteSuccess,
}: PaymentListProps) {
  const { dateRange } = useDateRange()
  const { getPayments } = useGetPayments(dateRange)
  const paymentsPromise = useMemo(() => getPayments(), [getPayments])
  const { promiseCategories } = useCategories()

  return (
    <Suspense fallback={<Spinner size="3" />}>
      <Table.Root aria-label="payment-list" variant="surface" size="2">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell minWidth="120px">
              Date
            </Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Category</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Note</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell align="right">
              Amount&nbsp;(¥)
            </Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          <TableBodyContent
            promiseCategories={promiseCategories}
            getPayments={paymentsPromise}
            onDeleteSuccess={onDeleteSuccess}
          />
        </Table.Body>
      </Table.Root>
    </Suspense>
  )
})

interface TableBodyContentProps {
  promiseCategories: Promise<Category[]>
  getPayments: Promise<Payment[]>
  onDeleteSuccess: () => void
}

const TableBodyContent = memo(function Body({
  promiseCategories,
  getPayments,
  onDeleteSuccess,
}: TableBodyContentProps) {
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
