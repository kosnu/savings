import { Flex, Skeleton, Text } from "@radix-ui/themes"
import { memo, Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { useTranslation } from "react-i18next"

import { formatTargetMonthKey, toMonthStartDate, toTargetMonth } from "../../../domain/date"
import { toCurrency } from "../../../utils/toCurrency"
import { useDateRange } from "../../../utils/useDateRange"
import { MonthlyBudgetUsage, usePrefetchEffectiveMonthlyBudget } from "../../budgets"
import { usePrefetchTotalExpenditures, useTotalExpenditures } from "./useTotalExpenditures"

import styles from "./MonthlyTotals.module.css"

function MonthlyTotals() {
  const { t } = useTranslation()
  const { date } = useDateRange()
  const targetDate = date ? toMonthStartDate(date) : null

  return (
    <Flex
      direction="column"
      flexGrow="1"
      gap="1"
      aria-label={t("payments.total.label")}
      width="100%"
    >
      {targetDate ? (
        <MonthlyTotalsContent
          targetDate={targetDate}
          targetMonth={formatTargetMonthKey(toTargetMonth(targetDate))}
        />
      ) : (
        <MonthlyTotalsLoading />
      )}
    </Flex>
  )
}

function MonthlyTotalsContent({
  targetDate,
  targetMonth,
}: {
  targetDate: Date
  targetMonth: string
}) {
  const { t } = useTranslation()

  usePrefetchTotalExpenditures(targetMonth)
  usePrefetchEffectiveMonthlyBudget(targetMonth)

  return (
    <>
      <Flex align="baseline" justify="between" width="100%">
        <Text color="gray" mr="1" size="2">
          {t("payments.total.heading")}
        </Text>
        <ErrorBoundary
          fallback={<Text color="red">{t("common.failed")}</Text>}
          resetKeys={[targetMonth]}
        >
          <Suspense fallback={<TotalMoneyText loading />}>
            <MoneyText targetMonth={targetMonth} />
          </Suspense>
        </ErrorBoundary>
      </Flex>
      <Flex justify="end" align="center" width="100%">
        <ErrorBoundary fallback={null} resetKeys={[targetMonth]}>
          <Suspense
            fallback={
              <MonthlyBudgetUsage
                targetDate={targetDate}
                totalExpenditures={null}
                totalExpendituresError={null}
                totalExpendituresLoading
              />
            }
          >
            <ResolvedMonthlyBudgetUsage targetDate={targetDate} targetMonth={targetMonth} />
          </Suspense>
        </ErrorBoundary>
      </Flex>
    </>
  )
}

function MonthlyTotalsLoading() {
  const { t } = useTranslation()

  return (
    <>
      <Flex align="baseline" justify="between" width="100%">
        <Text color="gray" mr="1" size="2">
          {t("payments.total.heading")}
        </Text>
        <TotalMoneyText loading />
      </Flex>
      <Flex justify="end" align="center" width="100%" />
    </>
  )
}

const MoneyText = memo(function MoneyText({ targetMonth }: { targetMonth: string }) {
  const { data } = useTotalExpenditures(targetMonth)
  const text = getMoneyText(data, false)

  return <TotalMoneyText text={text} />
})

function ResolvedMonthlyBudgetUsage({
  targetDate,
  targetMonth,
}: {
  targetDate: Date
  targetMonth: string
}) {
  const { data } = useTotalExpenditures(targetMonth)

  return (
    <MonthlyBudgetUsage
      targetDate={targetDate}
      totalExpenditures={data}
      totalExpendituresError={null}
      totalExpendituresLoading={false}
    />
  )
}

interface TotalMoneyTextProps {
  loading?: boolean
  text?: string
}

function TotalMoneyText({ loading = false, text = "\u00A0" }: TotalMoneyTextProps) {
  const { t } = useTranslation()

  return (
    <Skeleton
      loading={loading}
      data-testid={loading ? t("payments.total.skeleton") : undefined}
      style={{ minWidth: 0 }}
    >
      <Text align="right" aria-hidden={loading} className={styles.amount} size="6" weight="bold">
        {text}
      </Text>
    </Skeleton>
  )
}

function getMoneyText(data: number | null, loading: boolean): string {
  if (loading) {
    return "\u00A0"
  }

  if (data === null) {
    return "-"
  }

  return toCurrency(data)
}

const MemoisedMonthlyTotals = memo(MonthlyTotals)

export { MemoisedMonthlyTotals as MonthlyTotals }
