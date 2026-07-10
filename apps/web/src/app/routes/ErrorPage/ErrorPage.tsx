import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Button, Container, Flex, Heading, Text } from "@radix-ui/themes"
import { Link, type ErrorComponentProps } from "@tanstack/react-router"
import { useEffect, useId } from "react"
import { useTranslation } from "react-i18next"

export function ErrorPage({ error }: ErrorComponentProps) {
  const id = useId()
  const { t } = useTranslation()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <Container id={`error-page-${id}`} px="4" size="2">
      <Flex align="start" direction="column" gap="4">
        <Flex align="center" gap="2">
          <ExclamationTriangleIcon aria-hidden width="22" height="22" />
          <Heading as="h1" size="5">
            {t("error.title")}
          </Heading>
        </Flex>
        <Text as="p" color="gray" size="3">
          {t("error.description")}
        </Text>
        <Flex gap="3" wrap="wrap">
          <Button type="button" onClick={() => window.location.reload()}>
            {t("error.reload")}
          </Button>
          <Button asChild variant="soft">
            <Link to="/">{t("error.goHome")}</Link>
          </Button>
        </Flex>
      </Flex>
    </Container>
  )
}
