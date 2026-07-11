import { Card, Flex } from "@radix-ui/themes"

import { CategoryTotals } from "../CategoryTotals"
import { MonthlyTotals } from "../MonthlyTotals"
import { MonthSelector } from "../MonthSelector"

interface SummaryProps {
  cacheScope?: string
}

export function Summary({ cacheScope }: SummaryProps) {
  return (
    <Flex direction="column" gap="3" width="100%">
      <Flex justify="center">
        <MonthSelector />
      </Flex>
      <Card size="2">
        <Flex direction="column" width="100%">
          <MonthlyTotals />
        </Flex>
      </Card>
      <Card size="2">
        <CategoryTotals cacheScope={cacheScope} />
      </Card>
    </Flex>
  )
}
