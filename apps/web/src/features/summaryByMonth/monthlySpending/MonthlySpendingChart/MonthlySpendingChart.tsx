import { Box, Button, Card, Flex, Heading, Skeleton, Text } from "@radix-ui/themes"
import { QueryErrorResetBoundary, useSuspenseQueries } from "@tanstack/react-query"
import { Suspense, useId, useRef, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { useTranslation } from "react-i18next"

import { formatTargetMonthKey, toTargetMonth } from "../../../../domain/date"
import { useDateRange } from "../../../../utils/useDateRange"
import { effectiveMonthlyBudgetQueryOptions } from "../../../budgets"
import { monthlySpendingQueryOptions } from "../../../payments"
import { MonthlySpendingGraph } from "../MonthlySpendingGraph"

import styles from "./MonthlySpendingChart.module.css"

interface MonthlySpendingChartProps {
  bookId?: number
  loading?: boolean
}

export function MonthlySpendingChart({ bookId, loading = false }: MonthlySpendingChartProps) {
  const { t } = useTranslation()
  const headingId = useId()
  const sectionRef = useRef<HTMLElement>(null)
  const { date } = useDateRange()
  const targetMonth = formatTargetMonthKey(toTargetMonth(date))

  return (
    <Card size="2">
      <Flex asChild direction="column" gap="3">
        <section aria-labelledby={headingId} ref={sectionRef} tabIndex={-1}>
          <Heading as="h2" size="4" weight="medium" id={headingId}>
            {t("summary.spendingChart.title")}
          </Heading>
          <Box className={styles.content}>
            {loading || bookId === undefined ? (
              <MonthlySpendingChartLoading />
            ) : (
              <QueryErrorResetBoundary>
                {({ reset }) => (
                  <ErrorBoundary
                    onReset={reset}
                    resetKeys={[bookId, targetMonth]}
                    fallbackRender={({ resetErrorBoundary }) => (
                      <Flex direction="column" align="start" gap="2">
                        <Text color="red" size="2" role="alert">
                          {t("summary.spendingChart.loadError")}
                        </Text>
                        <Button
                          type="button"
                          variant="soft"
                          onClick={() => {
                            resetErrorBoundary()
                            sectionRef.current?.focus()
                          }}
                        >
                          {t("common.retry")}
                        </Button>
                      </Flex>
                    )}
                  >
                    <Suspense fallback={<MonthlySpendingChartLoading />}>
                      <MonthlySpendingChartResolved
                        key={`${bookId}:${targetMonth}`}
                        bookId={bookId}
                        targetMonth={targetMonth}
                        targetDate={date}
                      />
                    </Suspense>
                  </ErrorBoundary>
                )}
              </QueryErrorResetBoundary>
            )}
          </Box>
        </section>
      </Flex>
    </Card>
  )
}

function MonthlySpendingChartResolved({
  bookId,
  targetMonth,
  targetDate,
}: {
  bookId: number
  targetMonth: string
  targetDate: Date
}) {
  const [today] = useState(() => new Date())
  const [spending, budget] = useSuspenseQueries({
    queries: [
      monthlySpendingQueryOptions(bookId, targetMonth),
      effectiveMonthlyBudgetQueryOptions(targetMonth),
    ],
  })

  return (
    <MonthlySpendingGraph
      payments={spending.data}
      budget={budget.data}
      targetDate={targetDate}
      today={today}
    />
  )
}

function MonthlySpendingChartLoading() {
  const { t } = useTranslation()

  return (
    <Flex
      direction="column"
      gap="3"
      aria-busy="true"
      aria-label={t("summary.spendingChart.loading")}
    >
      <Skeleton width="100%" height="12rem" />
      <Skeleton width="100%" height="var(--space-5)" />
      <Skeleton width="100%" height="var(--space-5)" />
    </Flex>
  )
}
