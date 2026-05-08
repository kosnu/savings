import { Flex, Grid, Text } from "@radix-ui/themes"

export function CategorySettingsList() {
  return (
    <Flex direction="column" gap="3">
      <Text as="p" size="4" weight="medium">
        Categories
      </Text>
      <Grid columns={{ initial: "1fr", sm: "1fr minmax(120px, auto) minmax(72px, auto)" }} gap="3">
        <Text color="gray">Name</Text>
        <Text color="gray">Monthly budget</Text>
        <Text color="gray">Pin</Text>
      </Grid>
    </Flex>
  )
}
