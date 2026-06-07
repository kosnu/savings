import { Box, Container, Flex } from "@radix-ui/themes"
import { useState } from "react"

import { CreatePaymentModal, PaymentCategoryFilter, PaymentList } from "../../../features/payments"
import { Summary } from "../../../features/summaryByMonth"
import { useInitializePaymentsMonthSearch } from "./useInitializePaymentsMonthSearch"

export function PaymentsPage() {
  useInitializePaymentsMonthSearch()
  const [paymentsPageCacheScope] = useState(() => `payments-page-${crypto.randomUUID()}`)

  return (
    <Container size="4">
      <Flex direction="column" gap="3">
        <Summary cacheScope={paymentsPageCacheScope} />
        <Flex align="center" gap="3">
          <Box flexGrow="1" minWidth="0">
            <PaymentCategoryFilter />
          </Box>
          <Box flexShrink="0">
            <CreatePaymentModal />
          </Box>
        </Flex>
        <PaymentList cacheScope={paymentsPageCacheScope} />
      </Flex>
    </Container>
  )
}
