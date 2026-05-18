import { Card, Flex } from "@radix-ui/themes"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../../components/misc/Accordion"
import { CategoryTotals } from "../CategoryTotals"
import { MonthlyTotals } from "../MonthlyTotals"
import { MonthSelector } from "../MonthSelector"

interface SummaryProps {
  cacheScope?: string
}

export function Summary({ cacheScope }: SummaryProps) {
  return (
    <Card size="2">
      <Flex gap="1" direction="column" width="100%">
        <MonthSelector />
        <MonthlyTotals />
        <Accordion type="single" collapsible>
          <AccordionItem value="item-1">
            <AccordionTrigger style={{ padding: 0 }}>Spending by Category</AccordionTrigger>
            <AccordionContent>
              <CategoryTotals cacheScope={cacheScope} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Flex>
    </Card>
  )
}
