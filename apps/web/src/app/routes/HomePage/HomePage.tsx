import { Container, Flex, Heading, Skeleton, Text } from "@radix-ui/themes"
import { Suspense, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { useTranslation } from "react-i18next"

import { useSelectedBook } from "../../../features/books"
import { CreatePaymentModal, RecentPayments } from "../../../features/payments"
import { Summary } from "../../../features/summaryByMonth"
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
    <AppLayout>
      <Container size="2">
        <ErrorBoundary
          fallback={
            <Text color="red" role="alert">
              {t("common.failed")}
            </Text>
          }
          resetKeys={[session?.user.id]}
        >
          <Suspense
            fallback={
              <Skeleton>
                <Text>{t("navigation.home")}</Text>
              </Skeleton>
            }
          >
            {session ? (
              <HomePageContent authUserId={session.user.id} cacheScope={cacheScope} />
            ) : (
              <Skeleton>
                <Text>{t("navigation.home")}</Text>
              </Skeleton>
            )}
          </Suspense>
        </ErrorBoundary>
      </Container>
    </AppLayout>
  )
}

function HomePageContent({ authUserId, cacheScope }: { authUserId: string; cacheScope: string }) {
  const { book } = useSelectedBook(authUserId)
  const { t } = useTranslation()

  return (
    <Flex direction="column" gap="3">
      <Heading as="h1" size="6">
        {t("navigation.home")}
      </Heading>
      <Summary cacheScope={cacheScope} monthSelectorTo="/" />
      <Flex align="center" justify="between" gap="3" wrap="wrap">
        <Heading as="h2" size="4" weight="medium">
          {t("payments.recent")}
        </Heading>
        <CreatePaymentModal bookId={book.id} />
      </Flex>
      <RecentPayments bookId={book.id} cacheScope={cacheScope} />
    </Flex>
  )
}
