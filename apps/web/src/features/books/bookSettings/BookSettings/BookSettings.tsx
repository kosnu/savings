import { Flex } from "@radix-ui/themes"

import { LatestMonthlyBudget } from "../../../budgets/latestMonthlyBudget/LatestMonthlyBudget"
import { CategorySettingsList } from "../../../categories/components/CategorySettingsList"

export function BookSettings() {
  return (
    <Flex direction="column" gap="5">
      <LatestMonthlyBudget />
      <CategorySettingsList />
    </Flex>
  )
}
