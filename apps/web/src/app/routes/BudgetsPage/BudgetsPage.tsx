import { Container, Flex, Heading } from "@radix-ui/themes"

import { MonthlyBudgetList } from "../../../features/budgets/listMonthlyBudget"

export function BudgetsPage() {
  return (
    <Container size="4">
      <Flex direction="column" gap="4">
        <Heading as="h1" size="6">
          Budgets
        </Heading>
        <MonthlyBudgetList />
      </Flex>
    </Container>
  )
}
