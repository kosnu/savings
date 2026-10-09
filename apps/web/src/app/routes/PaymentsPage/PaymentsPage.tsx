import { Box, Container, Flex, Heading } from "@radix-ui/themes"
import { Suspense, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { useTranslation } from "react-i18next"

import { useSelectedBook } from "../../../features/books"
import { CreatePaymentModal, PaymentCategoryFilter, PaymentList } from "../../../features/payments"
import { MonthSelector } from "../../../features/summaryByMonth"
import { useSupabaseSession } from "../../../providers/supabase/useSupabaseSession"
import { useInitializeMonthSearch } from "../../useInitializeMonthSearch"

export function PaymentsPage() {
  useInitializeMonthSearch()
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
  const { t } = useTranslation()

  return (
    <Container size="2">
      <Flex direction="column" gap="3">
        <Heading as="h1" size="6">
          {t("navigation.payments")}
        </Heading>
        <Flex justify="center">
          <MonthSelector />
        </Flex>
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
