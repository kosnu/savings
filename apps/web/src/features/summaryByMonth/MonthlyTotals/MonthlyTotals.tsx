import { Flex, Skeleton, Text } from "@radix-ui/themes"
import { memo, Suspense, use } from "react"
import { ErrorBoundary } from "react-error-boundary"

import { toCurrency } from "../../../utils/toCurrency"
import { useDateRange } from "../../../utils/useDateRange"
import { MonthlyBudgetUsage } from "../../budgets"
import { useTotalExpenditures } from "./useTotalExpenditures"

function MonthlyTotals() {
  const totalExpenditures = useTotalExpenditures()
  const { date } = useDateRange()

  return (
    <Flex align="end" gap="1" direction="column" flexGrow="1" aria-label="Total spending">
      <Flex justify="end" align="baseline" style={{ minWidth: "10ch" }}>
        <ErrorBoundary fallback={<Text color="red">Failed</Text>}>
          <Suspense fallback={<TotalMoneyText loading />}>
            <MoneyText getValue={totalExpenditures.promise} />
          </Suspense>
        </ErrorBoundary>
      </Flex>
      <Flex justify="end" align="center">
        <MonthlyBudgetUsage
          targetDate={date}
          totalExpenditures={totalExpenditures.data}
          totalExpendituresError={totalExpenditures.error}
          totalExpendituresLoading={totalExpenditures.loading}
        />
      </Flex>
    </Flex>
  )
}

interface MoneyTextProps {
  getValue?: Promise<number | null>
  loading?: boolean
}

const MoneyText = memo(function MoneyText({ getValue, loading = false }: MoneyTextProps) {
  const data = getValue ? use(getValue) : null
  const text = getMoneyText(data, loading)

  return <TotalMoneyText loading={loading} text={text} />
})

interface TotalMoneyTextProps {
  loading?: boolean
  text?: string
}

function TotalMoneyText({ loading = false, text = "\u00A0" }: TotalMoneyTextProps) {
  return (
    <Skeleton loading={loading} data-testid={loading ? "skeleton" : undefined}>
      <Flex align="baseline" justify="end" aria-hidden={loading} style={{ minWidth: "12ch" }}>
        <Text size="2" color="gray" mr="1">
          Total
        </Text>
        <Text align="right" size="6" weight="bold">
          {text}
        </Text>
      </Flex>
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
