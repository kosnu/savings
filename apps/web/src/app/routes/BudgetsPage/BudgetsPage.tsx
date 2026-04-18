import { Container, Flex, Heading } from "@radix-ui/themes"

export function BudgetsPage() {
  return (
    <Container size="4">
      <Flex direction="column" gap="3">
        <Heading as="h1" size="6">
          Budgets
        </Heading>
      </Flex>
    </Container>
  )
}
