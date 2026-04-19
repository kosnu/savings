import { Container, Flex, Heading } from "@radix-ui/themes"

import { CreateMonthlyBudgetModal } from "../../../features/budgets/createMonthlyBudget"
import { MonthlyBudgetList } from "../../../features/budgets/listMonthlyBudget"

export function BudgetsPage() {
  return (
    <Container size="4">
      <Flex direction="column" gap="4">
        <Flex align="center" justify="between" gap="3">
          <Heading as="h1" size="6">
            Budgets
          </Heading>
          <CreateMonthlyBudgetModal />
        </Flex>
        <MonthlyBudgetList />
      </Flex>
    </Container>
  )
}
