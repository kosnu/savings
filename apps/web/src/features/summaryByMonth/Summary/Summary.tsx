import { Card, Flex } from "@radix-ui/themes"
import { CategoryTotals } from "../CategoryTotals"
import { MonthlyTotals } from "../MonthlyTotals"

export function Summary() {
  return (
    <Card size="2">
      <Flex gap="3" direction="column" width="100%">
        <MonthlyTotals />
        <CategoryTotals />
      </Flex>
    </Card>
  )
}
