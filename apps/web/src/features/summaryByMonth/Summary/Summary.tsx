import { Card, Flex } from "@radix-ui/themes"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../../components/misc/Accordion"
import { CategoryTotals } from "../CategoryTotals"
import { MonthlyTotals } from "../MonthlyTotals"

export function Summary() {
  return (
    <Card size="2">
      <Flex gap="1" direction="column" width="100%">
        <MonthlyTotals />
        <Accordion type="single" collapsible>
          <AccordionItem value="item-1">
            <AccordionTrigger style={{ padding: 0 }}>
              Spending by Category
            </AccordionTrigger>
            <AccordionContent>
              <CategoryTotals />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Flex>
    </Card>
  )
}
