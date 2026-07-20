import { Flex } from "@radix-ui/themes"

import { LatestMonthlyBudget } from "../../../budgets"
import { CategorySettingsList } from "../../../categories"
import { CurrentBookInformation } from "../CurrentBookInformation"

export function BookSettings() {
  return (
    <Flex direction="column" gap="5">
      <CurrentBookInformation />
      <LatestMonthlyBudget />
      <CategorySettingsList />
    </Flex>
  )
}
