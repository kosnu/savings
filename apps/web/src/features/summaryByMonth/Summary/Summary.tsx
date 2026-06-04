import { Card, Flex, Separator } from "@radix-ui/themes"

import { CategoryTotals } from "../CategoryTotals"
import { MonthlyTotals } from "../MonthlyTotals"
import { MonthSelector } from "../MonthSelector"

interface SummaryProps {
  cacheScope?: string
}

export function Summary({ cacheScope }: SummaryProps) {
  return (
    <Card size="2">
      <Flex gap="3" direction="column" width="100%">
        <Flex align="start" justify="between" gap="2" wrap="wrap">
          <MonthSelector />
          <MonthlyTotals />
        </Flex>
        <Separator size="4" />
        <CategoryTotals cacheScope={cacheScope} />
      </Flex>
    </Card>
  )
}
