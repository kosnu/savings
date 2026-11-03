import { PlusIcon } from "@radix-ui/react-icons"
import { Button, Container, Flex, Heading, Skeleton, Text } from "@radix-ui/themes"
import { QueryErrorResetBoundary } from "@tanstack/react-query"
import { Suspense, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { useTranslation } from "react-i18next"

import { useSelectedBook } from "../../../features/books"
import { CreatePaymentModal, PaymentCard, RecentPayments } from "../../../features/payments"
import { MonthlySpendingChart, Summary } from "../../../features/summaryByMonth"
import { useSupabaseSession } from "../../../providers/supabase/useSupabaseSession"
import { AppLayout } from "../../AppLayout"
import { useInitializeMonthSearch } from "../../useInitializeMonthSearch"
import { TopPage } from "../TopPage"

export function HomePage() {
  useInitializeMonthSearch()
  const { status, session } = useSupabaseSession()
  const { t } = useTranslation()
  const [cacheScope] = useState(() => `home-page-${crypto.randomUUID()}`)

  if (status === "unauthenticated") {
    return <TopPage />
  }

  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ resetErrorBoundary }) => (
            <AppLayout stickyHeader>
              <Container size="2">
                <Flex direction="column" gap="2" align="start">
                  <Text color="red" role="alert">
                    {t("common.failed")}
                  </Text>
                  <Button type="button" variant="soft" onClick={resetErrorBoundary}>
                    {t("common.retry")}
                  </Button>
                </Flex>
              </Container>
            </AppLayout>
          )}
          resetKeys={[session?.user.id]}
        >
          <Suspense fallback={<HomePageLoading />}>
            {session ? (
              <HomePageContent authUserId={session.user.id} cacheScope={cacheScope} />
            ) : (
              <HomePageLoading />
            )}
          </Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  )
}

function HomePageContent({ authUserId, cacheScope }: { authUserId: string; cacheScope: string }) {
  const { book } = useSelectedBook(authUserId)
  const { t } = useTranslation()

  return (
    <AppLayout
      stickyHeader
      headerAction={
        <CreatePaymentModal
          bookId={book.id}
          trigger={
            <Button>
              <PlusIcon aria-hidden />
              {t("payments.create.trigger")}
            </Button>
          }
        />
      }
    >
      <Container size="2">
        <Flex direction="column" gap="3">
          <Summary
            cacheScope={cacheScope}
            monthSelectorTo="/"
            reserveSpace
            chart={<MonthlySpendingChart bookId={book.id} />}
          />
          <Heading as="h2" size="4" weight="medium">
            {t("payments.recent")}
          </Heading>
          <RecentPayments bookId={book.id} cacheScope={cacheScope} />
        </Flex>
      </Container>
    </AppLayout>
  )
}

function HomePageLoading() {
  const { t } = useTranslation()

  return (
    <AppLayout
      stickyHeader
      headerAction={
        <Skeleton>
          <Button disabled aria-hidden tabIndex={-1}>
            <PlusIcon aria-hidden />
            {t("payments.create.trigger")}
          </Button>
        </Skeleton>
      }
    >
      <Container size="2">
        <Flex direction="column" gap="3" aria-busy="true" data-testid="home-loading">
          <Summary loading reserveSpace chart={<MonthlySpendingChart loading />} />
          <Heading as="h2" size="4" weight="medium">
            {t("payments.recent")}
          </Heading>
          <Flex direction="column" gap="2" aria-hidden>
            {[0, 1, 2, 3, 4].map((row) => (
              <PaymentCard key={row} loading />
            ))}
          </Flex>
        </Flex>
      </Container>
    </AppLayout>
  )
}
