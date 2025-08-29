import { Container, Flex } from "@radix-ui/themes"
import { Aggregates } from "../../../features/aggregates"

export function AggregatesPage() {
  return (
    <Container size="4">
      <Flex direction="column" gap="3">
        <Aggregates />
      </Flex>
    </Container>
  )
}
