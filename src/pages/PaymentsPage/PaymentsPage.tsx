import { useCallback } from "react"
import { ContainedButton } from "../../components/buttons/ContainedButton"
import { useCreatePayment } from "../../features/createPayment"
import { PaymentList } from "../../features/listPayment"

export function PaymentsPage() {
  const { open, CreatePaymentModal } = useCreatePayment()

  const handleCreatePaymentButtonClick = useCallback(() => {
    open()
  }, [open])

  return (
    <>
      <ContainedButton onClick={handleCreatePaymentButtonClick}>
        Create payment
      </ContainedButton>
      <PaymentList />
      <CreatePaymentModal />
    </>
  )
}
