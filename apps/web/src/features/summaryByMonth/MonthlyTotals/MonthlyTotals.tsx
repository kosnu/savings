import { Flex, Skeleton, Text } from "@radix-ui/themes"
import { memo, Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { useTranslation } from "react-i18next"

import { toCurrency } from "../../../utils/toCurrency"
import { useDateRange } from "../../../utils/useDateRange"
import { MonthlyBudgetUsage } from "../../budgets"
import { useTotalExpenditures } from "./useTotalExpenditures"

import styles from "./MonthlyTotals.module.css"

function MonthlyTotals() {
  const { t } = useTranslation()
  const { date } = useDateRange()

  return (
    <Flex
      direction="column"
      flexGrow="1"
      gap="1"
      aria-label={t("payments.total.label")}
      width="100%"
    >
      <Flex align="baseline" justify="between" width="100%">
        <Text color="gray" mr="1" size="2">
          {t("payments.total.heading")}
        </Text>
        <ErrorBoundary fallback={<Text color="red">{t("common.failed")}</Text>}>
          <Suspense fallback={<TotalMoneyText loading />}>
            {date ? <MoneyText /> : <TotalMoneyText loading />}
          </Suspense>
        </ErrorBoundary>
      </Flex>
      <Flex justify="end" align="center" width="100%">
        {date ? (
          <ErrorBoundary fallback={null} resetKeys={[date.toISOString()]}>
            <Suspense
              fallback={
                <MonthlyBudgetUsage
                  targetDate={date}
                  totalExpenditures={null}
                  totalExpendituresError={null}
                  totalExpendituresLoading
                />
              }
            >
              <ResolvedMonthlyBudgetUsage targetDate={date} />
            </Suspense>
          </ErrorBoundary>
        ) : null}
      </Flex>
    </Flex>
  )
}

const MoneyText = memo(function MoneyText() {
  const { data } = useTotalExpenditures()
  const text = getMoneyText(data, false)

  return <TotalMoneyText text={text} />
})

function ResolvedMonthlyBudgetUsage({ targetDate }: { targetDate: Date }) {
  const { data } = useTotalExpenditures()

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
