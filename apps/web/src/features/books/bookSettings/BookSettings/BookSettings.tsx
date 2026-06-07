import { Flex } from "@radix-ui/themes"

import { LatestMonthlyBudget } from "../../../budgets"
import { CategorySettingsList } from "../../../categories"

export function BookSettings() {
  return (
    <Flex direction="column" gap="5">
      <LatestMonthlyBudget />
      <CategorySettingsList />
    </Flex>
  )
}
