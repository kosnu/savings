import { Card, Flex, Spinner, Text } from "@radix-ui/themes"
import { Suspense, memo, use } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { toCurrency } from "../../../utils/toCurrency"

interface MoneyCardProps {
  title: string
  getValue: Promise<number | null>
}

function MoneyCard({ title, getValue }: MoneyCardProps) {
  return (
    <Card size="4" style={{ width: "100%" }}>
      <Flex gap="1" direction="column">
        <Text>{title}</Text>
        <ErrorBoundary
          fallbackRender={() => (
            <Text color="red">An unexpected error has occurred.</Text>
          )}
        >
          <Suspense fallback={<Spinner size="3" />}>
            <MoneyText getValue={getValue} />
          </Suspense>
        </ErrorBoundary>
      </Flex>
    </Card>
  )
}

const MoneyText = memo(function MoneyText({
  getValue,
}: { getValue: Promise<number | null> }) {
  const data = use(getValue)
  const text = data !== null ? toCurrency(data) : "-"

  return (
    <Text weight="bold" size="5">
      {text}
    </Text>
  )
})

const MemoisedMoneyCard = memo(MoneyCard)

export { MemoisedMoneyCard as MoneyCard }
