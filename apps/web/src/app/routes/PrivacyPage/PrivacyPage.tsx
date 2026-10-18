import { Container, Flex, Heading, Link as ThemeLink, Text } from "@radix-ui/themes"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

const contactEmail = "support@burneto.com"

export function PrivacyPage() {
  const { t } = useTranslation()

  return (
    <main>
      <Container size="2" p="4">
        <Flex direction="column" gap="4">
          <ThemeLink asChild size="2">
            <Link to="/">{t("privacy.back", { appName: t("app.name") })}</Link>
          </ThemeLink>
          <Heading as="h1" size="6">
            {t("privacy.title")}
          </Heading>
          <Text as="p" size="3">
            {t("privacy.introduction", { appName: t("app.name") })}
          </Text>

          <Flex asChild direction="column" gap="3">
            <section aria-labelledby="privacy-information">
              <Heading as="h2" size="4" weight="medium" id="privacy-information">
                {t("privacy.information.title")}
              </Heading>
              <Text as="p" size="3">
                {t("privacy.information.account")}
              </Text>
              <Text as="p" size="3">
                {t("privacy.information.records")}
              </Text>
              <Text as="p" size="3">
                {t("privacy.information.logs")}
              </Text>
            </section>
          </Flex>

          <Flex asChild direction="column" gap="3">
            <section aria-labelledby="privacy-transmission">
              <Heading as="h2" size="4" weight="medium" id="privacy-transmission">
                {t("privacy.transmission.title")}
              </Heading>
              <Text as="p" size="3">
                {t("privacy.transmission.authentication")}
              </Text>
              <Text as="p" size="3">
                {t("privacy.transmission.records")}
              </Text>
              <Text as="p" size="3">
                {t("privacy.transmission.delivery")}
              </Text>
              <Text as="p" size="3">
                {t("privacy.transmission.diagnostics")}
              </Text>
              <Text as="p" size="3">
                {t("privacy.transmission.contact")}
              </Text>
            </section>
          </Flex>

          <Flex asChild direction="column" gap="3">
            <section aria-labelledby="privacy-storage">
              <Heading as="h2" size="4" weight="medium" id="privacy-storage">
                {t("privacy.storage.title")}
              </Heading>
              <Text as="p" size="3">
                {t("privacy.storage.access")}
              </Text>
              <Text as="p" size="3">
                {t("privacy.storage.browser")}
              </Text>
              <Text as="p" size="3">
                {t("privacy.storage.deletion")}
              </Text>
              <Text as="p" size="3">
                {t("privacy.storage.retention")}
              </Text>
            </section>
          </Flex>

          <Flex asChild direction="column" gap="3">
            <section aria-labelledby="privacy-contact">
              <Heading as="h2" size="4" weight="medium" id="privacy-contact">
                {t("privacy.contact.title")}
              </Heading>
              <Text as="p" size="3">
                {t("privacy.contact.description")}
              </Text>
              <ThemeLink href={`mailto:${contactEmail}`} size="3" wrap="wrap">
                {contactEmail}
              </ThemeLink>
              <Text as="p" size="3">
                {t("privacy.contact.reply")}
              </Text>
              <Text as="p" size="3">
                {t("privacy.contact.operator")}
              </Text>
            </section>
          </Flex>
        </Flex>
      </Container>
    </main>
  )
}
