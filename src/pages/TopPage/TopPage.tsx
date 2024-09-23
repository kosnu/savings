import { Button } from "@mui/material"
import { useCallback } from "react"
import { useCreatePayment } from "../../features/createPayment"

export function TopPage() {
  const { open, CreatePaymentModal } = useCreatePayment()

  const handleCreatePaymentButtonClick = useCallback(() => {
    open()
  }, [open])

  return (
    <>
      <Button variant="contained" onClick={handleCreatePaymentButtonClick}>
        Create payment
      </Button>
      <CreatePaymentModal />
    </>
  )
}
