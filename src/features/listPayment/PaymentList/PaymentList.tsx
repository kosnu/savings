import { Spinner, Table } from "@radix-ui/themes"
import { Suspense, memo, use } from "react"
import {} from "react/canary"
import type { Payment } from "../../../types/payment"
import { formatDateToLocaleString } from "../../../utils/formatter/formatDateToLocaleString"
import { useGetPayments } from "../useGetPayments"

export const PaymentList = memo(function PaymentList() {
  const { getPayments } = useGetPayments()

  return (
    <>
      <Suspense fallback={<Spinner size="3" />}>
        <Table.Root aria-label="simple table" variant="surface" size="2">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell minWidth="120px">
                Date
              </Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Title</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell align="right">
                Price&nbsp;(¥)
              </Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            <Body getPayments={getPayments()} />
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
        <Table.Row key={payment.id}>
          <Table.RowHeaderCell>
            {formatDateToLocaleString(payment.date)}
          </Table.RowHeaderCell>
          <Table.Cell>{payment.title}</Table.Cell>
          <Table.Cell align="right">{payment.price}</Table.Cell>
        </Table.Row>
      ))}
    </>
  )
})
