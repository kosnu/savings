import { Container, Flex, Heading } from "@radix-ui/themes"

export function SettingsPage() {
  return (
    <Container size="4">
      <Flex direction="column" gap="4">
        <Heading as="h1" size="6">
          Settings
        </Heading>
      </Flex>
    </Container>
  )
}
