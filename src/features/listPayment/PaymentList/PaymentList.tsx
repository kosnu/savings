import { Spinner, Table } from "@radix-ui/themes"
import { Suspense, memo, use, useMemo } from "react"
import type { Payment } from "../../../types/payment"
import { useDateRange } from "../../../utils/useDateRange"
import { PaymentItem } from "../PaymentItem"
import { useGetPayments } from "../useGetPayments"

export const PaymentList = memo(function PaymentList() {
  const { dateRange } = useDateRange()
  const { getPayments } = useGetPayments(dateRange)
  const paymentsPromise = useMemo(() => getPayments(), [getPayments])

  return (
    <>
      <Suspense fallback={<Spinner size="3" />}>
        <Table.Root aria-label="payment-list" variant="surface" size="2">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell minWidth="120px">
                Date
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Note</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell align="right">
                Amount&nbsp;(¥)
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell />
            </Table.Row>
          </Table.Header>
          <Table.Body>
            <Body getPayments={paymentsPromise} />
          </Table.Body>
        </Table.Root>
      </Suspense>
    </>
  )
})

const Body = memo(function Body({
  getPayments,
}: { getPayments: Promise<Payment[]> }) {
  const data = use(getPayments)

  return (
    <>
      {data.map((payment) => (
        <PaymentItem key={payment.id} payment={payment} />
      ))}
    </>
  )
})
