import { Container, Flex, Text } from "@radix-ui/themes"
import { useTranslation } from "react-i18next"

export function AggregatesPage() {
  const { t } = useTranslation()

  return (
    <Container size="4">
      <Flex direction="column" gap="3">
        <Flex direction="column" gap="3" width="100%">
          <Text size="6" weight="bold">
            {t("aggregates.title")}
          </Text>
          <Text>{t("aggregates.placeholder")}</Text>
        </Flex>
      </Flex>
    </Container>
  )
}
