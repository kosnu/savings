import { Box, Container, Flex } from "@radix-ui/themes"
import { Suspense, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"

import { useSelectedBook } from "../../../features/books"
import { CreatePaymentModal, PaymentCategoryFilter, PaymentList } from "../../../features/payments"
import { Summary } from "../../../features/summaryByMonth"
import { useSupabaseSession } from "../../../providers/supabase/useSupabaseSession"
import { useInitializePaymentsMonthSearch } from "./useInitializePaymentsMonthSearch"

export function PaymentsPage() {
  useInitializePaymentsMonthSearch()
  const [paymentsPageCacheScope] = useState(() => `payments-page-${crypto.randomUUID()}`)
  const { session } = useSupabaseSession()

  if (!session) {
    return null
  }

  return (
    <ErrorBoundary fallback={null} resetKeys={[session.user.id]}>
      <Suspense fallback={null}>
        <PaymentsPageContent
          authUserId={session.user.id}
          paymentsPageCacheScope={paymentsPageCacheScope}
        />
      </Suspense>
    </ErrorBoundary>
  )
}

function PaymentsPageContent({
  authUserId,
  paymentsPageCacheScope,
}: {
  authUserId: string
  paymentsPageCacheScope: string
}) {
  const { book } = useSelectedBook(authUserId)

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
