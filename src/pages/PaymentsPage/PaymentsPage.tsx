import { CreatePaymentModal } from "../../features/createPayment"
import { PaymentList } from "../../features/listPayment"

export function PaymentsPage() {
  return (
    <>
      <CreatePaymentModal />
      <PaymentList />
    </>
  )
}
