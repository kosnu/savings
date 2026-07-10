import { Button, Container, Flex, Text } from "@radix-ui/themes"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

export function TopPage() {
  const { t } = useTranslation()

  return (
    <>
      <Container px="4" size="2">
        <Flex direction="column" gap="3">
          <Text asChild size="5" weight="bold">
            <h2>{t("app.name")}</h2>
          </Text>
          <Flex direction="column" gap="2">
            <Button asChild>
              <Link to="/auth">{t("auth.goToAuth")}</Link>
            </Button>
          </Flex>
        </Flex>
      </Container>
    </>
  )
}
