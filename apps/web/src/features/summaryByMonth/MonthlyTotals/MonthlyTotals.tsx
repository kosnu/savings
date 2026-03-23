import { Flex, Skeleton, Text } from "@radix-ui/themes"
import { memo, Suspense, use } from "react"
import { ErrorBoundary } from "react-error-boundary"

import { toCurrency } from "../../../utils/toCurrency"
import { useTotalExpenditures } from "../useTotalExpenditures"

function MonthlyTotals() {
  const { promise } = useTotalExpenditures()

  return (
    <Flex gap="1" direction="column">
      <Text size="3" color="gray">
        Total spending
      </Text>
      <Flex justify="end" align="center">
        <ErrorBoundary fallback={<Text color="red">An unexpected error has occurred.</Text>}>
          <Suspense fallback={<MoneyText loading />}>
            <MoneyText getValue={promise} />
          </Suspense>
        </ErrorBoundary>
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

  return (
    <Skeleton loading={loading} data-testid={loading ? "skeleton" : undefined}>
      <Text
        align="right"
        size="6"
        weight="bold"
        style={{ display: "inline-block", minWidth: "10ch" }}
        aria-hidden={loading}
      >
        {text}
      </Text>
    </Skeleton>
  )
})

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
