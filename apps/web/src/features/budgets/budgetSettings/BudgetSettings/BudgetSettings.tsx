import { Flex } from "@radix-ui/themes"

import { LatestMonthlyBudget } from "../../latestMonthlyBudget/LatestMonthlyBudget/LatestMonthlyBudget"
import { CategoryBudgetList } from "../../listCategoryBudget/CategoryBudgetList"

export function BudgetSettings() {
  return (
    <Flex direction="column" gap="5">
      <LatestMonthlyBudget />
      <CategoryBudgetList />
    </Flex>
  )
}
