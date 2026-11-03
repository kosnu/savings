import { Box, Button, Card, Flex, Heading, Skeleton, Text } from "@radix-ui/themes"
import { QueryErrorResetBoundary, useSuspenseQueries } from "@tanstack/react-query"
import { subMonths } from "date-fns"
import { Suspense, useEffect, useId, useRef, useState } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { useTranslation } from "react-i18next"

import { formatTargetMonthKey, isSupportedDate, toTargetMonth } from "../../../../domain/date"
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
  const [referenceDate, setReferenceDate] = useState(() => new Date())
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    function schedule() {
      const now = new Date()
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      timer = setTimeout(() => {
        setReferenceDate(new Date())
        schedule()
      }, midnight.getTime() - now.getTime())
    }
    const refresh = () => setReferenceDate(new Date())
    schedule()
    window.addEventListener("focus", refresh)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("focus", refresh)
    }
  }, [])
  const historyMonths =
    targetMonth === formatTargetMonthKey(toTargetMonth(referenceDate))
      ? [1, 2, 3]
          .map((offset) => subMonths(targetDate, offset))
          .filter(isSupportedDate)
          .map((date) => formatTargetMonthKey(toTargetMonth(date)))
      : []
  const currentQuery = monthlySpendingQueryOptions(bookId, targetMonth)
  const budgetQuery = effectiveMonthlyBudgetQueryOptions(targetMonth)
  const [first, second, third] = historyMonths.map((month) =>
    monthlySpendingQueryOptions(bookId, month),
  )
  const queries = third
    ? ([currentQuery, budgetQuery, first, second, third] as const)
    : second
      ? ([currentQuery, budgetQuery, first, second] as const)
      : first
        ? ([currentQuery, budgetQuery, first] as const)
        : ([currentQuery, budgetQuery] as const)
  const [spending, budget, ...history] = useSuspenseQueries<
    | [typeof currentQuery, typeof budgetQuery]
    | [typeof currentQuery, typeof budgetQuery, typeof first]
    | [typeof currentQuery, typeof budgetQuery, typeof first, typeof second]
    | [typeof currentQuery, typeof budgetQuery, typeof first, typeof second, typeof third]
  >({ queries })

  return (
    <MonthlySpendingGraph
      payments={spending.data}
      budget={budget.data}
      targetDate={targetDate}
      today={new Date(Math.max(referenceDate.getTime(), spending.dataUpdatedAt))}
      history={history.map((query, index) => ({
        month: historyMonths[index],
        payments: query.data,
      }))}
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
