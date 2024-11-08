import {
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material"
import { Suspense, use } from "react"
import {} from "react/canary"
import type { Payment } from "../../../types/payment"
import { formatDateToLocaleString } from "../../../utils/formatter/formatDateToLocaleString"
import { useGetPayments } from "../useGetPayments"

// FIXME: 支払い情報を追加してもリストが更新されない
export function PaymentList() {
  const { getPayments } = useGetPayments()

  return (
    <>
      <Suspense fallback={<CircularProgress />}>
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }} aria-label="simple table">
            <TableHead>
              <TableRow>
                <TableCell sx={{ maxWidth: 120 }}>Date</TableCell>
                <TableCell>Title</TableCell>
                <TableCell align="right">Price&nbsp;(¥)</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              <Body getPayments={getPayments} />
            </TableBody>
          </Table>
        </TableContainer>
      </Suspense>
    </>
  )
}

function Body({ getPayments }: { getPayments: () => Promise<Payment[]> }) {
  const data = use(getPayments())

  return (
    <>
      {data.map((payment) => (
        <TableRow
          key={payment.id}
          sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
        >
          <TableCell>{formatDateToLocaleString(payment.date)}</TableCell>
          <TableCell>{payment.title}</TableCell>
          <TableCell align="right">{payment.price}</TableCell>
        </TableRow>
      ))}
    </>
  )
}
