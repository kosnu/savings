import { Flex } from "@radix-ui/themes"
import { CreatePaymentModal } from "../../../features/createPayment"
import { PaymentList } from "../../../features/listPayment"

export function PaymentsPage() {
  return (
    <>
      <Flex direction="column" gap="3">
        <Flex justify="end" align="center" gap="3">
          <CreatePaymentModal />
        </Flex>
        <PaymentList />
      </Flex>
    </>
  )
}
