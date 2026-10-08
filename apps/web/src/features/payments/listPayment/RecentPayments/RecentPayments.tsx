import { Button, Flex, Text } from "@radix-ui/themes"
import { QueryErrorResetBoundary, useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { useTranslation } from "react-i18next"

import { paymentQueryKeys } from "../../queryKeys"
import { fetchPayments } from "../fetchPayments"
import { PaymentCard } from "../PaymentCard"
import { PaymentItem } from "../PaymentItem"

interface RecentPaymentsProps {
  bookId: number
  cacheScope: string
}

export function RecentPayments({ bookId, cacheScope }: RecentPaymentsProps) {
  const { t } = useTranslation()

  return (
    <Flex aria-label={t("payments.recent")} direction="column" gap="2">
      <QueryErrorResetBoundary>
        {({ reset }) => (
          <ErrorBoundary
            onReset={reset}
            fallbackRender={({ resetErrorBoundary }) => (
              <Flex direction="column" gap="2" align="start">
                <Text color="red" role="alert">
                  {t("payments.list.loadError")}
                </Text>
                <Button type="button" variant="soft" onClick={resetErrorBoundary}>
                  {t("common.retry")}
                </Button>
              </Flex>
            )}
            resetKeys={[bookId, cacheScope]}
          >
            <Suspense
              fallback={
                <>
                  <PaymentCard loading />
                  <PaymentCard loading />
                  <PaymentCard loading />
                </>
              }
            >
              <RecentPaymentsResolved bookId={bookId} cacheScope={cacheScope} />
            </Suspense>
          </ErrorBoundary>
        )}
      </QueryErrorResetBoundary>
    </Flex>
  )
}

function RecentPaymentsResolved({ bookId, cacheScope }: RecentPaymentsProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data } = useSuspenseQuery({
    queryKey: paymentQueryKeys.recent(bookId, cacheScope),
    queryFn: async () => fetchPayments(bookId, [null, null], { limit: 5 }),
    staleTime: 3000,
  })

  if (data.length === 0) {
    return <Text color="gray">{t("payments.list.empty")}</Text>
  }

  return data.slice(0, 5).map((payment) => {
    if (payment.id === undefined) return null
    const paymentId = payment.id
    return (
      <PaymentItem
        key={payment.id}
        payment={payment}
        category={payment.category ?? null}
        onOpen={() => {
          void navigate({
            to: "/payments/details/$paymentId",
            params: { paymentId: String(paymentId) },
            search: {
              year: String(payment.date.getFullYear()),
              month: String(payment.date.getMonth() + 1),
            },
          })
        }}
      />
    )
  })
}
