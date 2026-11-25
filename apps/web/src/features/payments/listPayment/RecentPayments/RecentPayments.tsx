import { Button, Flex, Text } from "@radix-ui/themes"
import { QueryErrorResetBoundary, useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { useTranslation } from "react-i18next"

import { formatTargetMonthKey, resolveTargetMonth, toTargetMonth } from "../../../../domain/date"
import { useDateRange } from "../../../../utils/useDateRange"
import { paymentQueryKeys } from "../../queryKeys"
import { fetchPayments } from "../fetchPayments"
import { PaymentCard } from "../PaymentCard"
import { PaymentItem } from "../PaymentItem"

interface RecentPaymentsProps {
  bookId: number
  cacheScope: string
}

const loadingPayments = [0, 1, 2, 3, 4].map((row) => <PaymentCard key={row} loading />)

export function RecentPayments({ bookId, cacheScope }: RecentPaymentsProps) {
  const { t } = useTranslation()
  const { date, dateRange } = useDateRange()
  const monthKey = formatTargetMonthKey(toTargetMonth(date))

  return (
    <Flex asChild direction="column" gap="2">
      <section aria-label={t("payments.recent", { targetDate: date })}>
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
              resetKeys={[bookId, cacheScope, monthKey]}
            >
              <Suspense key={monthKey} fallback={loadingPayments}>
                <RecentPaymentsResolved
                  bookId={bookId}
                  cacheScope={cacheScope}
                  month={date}
                  monthKey={monthKey}
                  dateRange={dateRange}
                />
              </Suspense>
            </ErrorBoundary>
          )}
        </QueryErrorResetBoundary>
      </section>
    </Flex>
  )
}

function RecentPaymentsResolved({
  bookId,
  cacheScope,
  month,
  monthKey,
  dateRange,
}: RecentPaymentsProps & { month: Date; monthKey: string; dateRange: [Date, Date] }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data, error, isFetching } = useSuspenseQuery({
    queryKey: paymentQueryKeys.recent(bookId, cacheScope, monthKey),
    queryFn: async () => fetchPayments(bookId, dateRange, { limit: 5 }),
    staleTime: 3000,
  })

  if (data.length === 0) {
    if (isFetching) return loadingPayments
    if (error) throw error
    return <Text color="gray">{t("payments.recent.empty", { targetDate: month })}</Text>
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
          const targetMonth = resolveTargetMonth(
            String(payment.date.getFullYear()),
            String(payment.date.getMonth() + 1),
          )
          void navigate({
            to: "/payments/details/$paymentId",
            params: { paymentId: String(paymentId) },
            search: {
              year: String(targetMonth.year),
              month: String(targetMonth.month),
            },
          })
        }}
      />
    )
  })
}
