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
        <ErrorBoundary
          fallback={<Text color="red">An unexpected error has occurred.</Text>}
        >
          <Suspense
            fallback={
              <Skeleton data-testid="skeleton" width="120px" height="28px" />
            }
          >
            <MoneyText getValue={promise} />
          </Suspense>
        </ErrorBoundary>
      </Flex>
    </Flex>
  )
}

const MoneyText = memo(function MoneyText({
  getValue,
}: {
  getValue: Promise<number | null>
}) {
  const data = use(getValue)
  const text = data === null ? "-" : toCurrency(data)

  return (
    <Text align="right" size="6" weight="bold">
      {text}
    </Text>
  )
})

const MemoisedMonthlyTotals = memo(MonthlyTotals)

export { MemoisedMonthlyTotals as MonthlyTotals }
