import { Box, Container, Flex } from "@radix-ui/themes"
import { useState } from "react"

import { useSelectedBook } from "../../../features/books"
import { CreatePaymentModal, PaymentCategoryFilter, PaymentList } from "../../../features/payments"
import { Summary } from "../../../features/summaryByMonth"
import { useSupabaseSession } from "../../../providers/supabase/useSupabaseSession"
import { useInitializePaymentsMonthSearch } from "./useInitializePaymentsMonthSearch"

export function PaymentsPage() {
  useInitializePaymentsMonthSearch()
  const [paymentsPageCacheScope] = useState(() => `payments-page-${crypto.randomUUID()}`)
  const { session } = useSupabaseSession()
  const { book, isPending, isError } = useSelectedBook(session?.user.id)

  if (isPending || isError || !book) {
    return null
  }

  return (
    <Container size="2">
      <Flex direction="column" gap="3">
        <Summary cacheScope={paymentsPageCacheScope} />
        <Flex align="center" gap="3">
          <Box flexGrow="1" minWidth="0">
            <PaymentCategoryFilter />
          </Box>
          <Box flexShrink="0">
            <CreatePaymentModal bookId={book.id} />
          </Box>
        </Flex>
        <PaymentList bookId={book.id} cacheScope={paymentsPageCacheScope} />
      </Flex>
    </Container>
  )
}
