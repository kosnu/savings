import { Container, Flex } from "@radix-ui/themes"

import { CreatePaymentModal } from "../../../features/payments/createPayment"
import { PaymentList } from "../../../features/payments/listPayment"
import { Summary } from "../../../features/summaryByMonth"

export function PaymentsPage() {
  return (
    <Container size="4">
      <Flex direction="column" gap="3">
        <Summary />
        <Flex justify="end" align="center" gap="3">
          <CreatePaymentModal />
        </Flex>
        <PaymentList />
      </Flex>
    </Container>
  )
}
