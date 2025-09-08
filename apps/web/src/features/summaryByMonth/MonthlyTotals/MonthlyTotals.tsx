import { Flex, Skeleton, Text } from "@radix-ui/themes"
import { memo, Suspense, use } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { toCurrency } from "../../../utils/toCurrency"
import { useTotalExpenditures } from "../useTotalExpenditures"

function MonthlyTotals() {
  const { promise } = useTotalExpenditures()

  return (
    <Flex gap="1" direction="column">
      <Text>Expenditures</Text>
      <ErrorBoundary
        fallback={<Text color="red">An unexpected error has occurred.</Text>}
      >
        <Suspense fallback={<Skeleton width="120px" height="28px" />}>
          <MoneyText getValue={promise} />
        </Suspense>
      </ErrorBoundary>
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
    <Text weight="bold" size="5">
      {text}
    </Text>
  )
})

const MemoisedMonthlyTotals = memo(MonthlyTotals)

export { MemoisedMonthlyTotals as MonthlyTotals }
