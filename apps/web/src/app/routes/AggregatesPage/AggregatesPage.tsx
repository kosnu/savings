import { Container, Flex, Text } from "@radix-ui/themes"

export function AggregatesPage() {
  return (
    <Container size="4">
      <Flex direction="column" gap="3">
        <Flex direction="column" gap="3" width="100%">
          <Text size="6" weight="bold">
            集計
          </Text>
          <Text>ここに集計機能が実装される予定です。</Text>
        </Flex>
      </Flex>
    </Container>
  )
}
