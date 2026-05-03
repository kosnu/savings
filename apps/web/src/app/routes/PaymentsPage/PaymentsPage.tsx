import { Box, Container, Flex } from "@radix-ui/themes"

import { CreatePaymentModal } from "../../../features/payments/createPayment"
import { PaymentCategoryFilter, PaymentList } from "../../../features/payments/listPayment"
import { Summary } from "../../../features/summaryByMonth"
import { useInitializePaymentsMonthSearch } from "./useInitializePaymentsMonthSearch"

export function PaymentsPage() {
  useInitializePaymentsMonthSearch()

  return (
    <Container size="4">
      <Flex direction="column" gap="3">
        <Summary />
        <Flex align="center" gap="3">
          <Box flexGrow="1" minWidth="0">
            <PaymentCategoryFilter />
          </Box>
          <Box flexShrink="0">
            <CreatePaymentModal />
          </Box>
        </Flex>
        <PaymentList />
      </Flex>
    </Container>
  )
}
