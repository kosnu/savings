import { Container, Flex, Heading, Link as ThemeLink, Text } from "@radix-ui/themes"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

// 問い合わせ用メールアドレスの準備後、この値を差し替える。未設定ではリンクを表示しない。
const contactEmail: string = ""

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
            <section aria-labelledby="privacy-services">
              <Heading as="h2" size="4" weight="medium" id="privacy-services">
                {t("privacy.services.title")}
              </Heading>
              <Text as="p" size="3">
                <ThemeLink href="https://policies.google.com/privacy">Google</ThemeLink>
                {t("privacy.services.google")}
              </Text>
              <Text as="p" size="3">
                <ThemeLink href="https://supabase.com/privacy">Supabase</ThemeLink>
                {t("privacy.services.supabase")}
              </Text>
              <Text as="p" size="3">
                <ThemeLink href="https://www.cloudflare.com/privacypolicy/">Cloudflare</ThemeLink>
                {t("privacy.services.cloudflare")}
              </Text>
              <Text as="p" size="3">
                <ThemeLink href="https://sentry.io/privacy/">Sentry</ThemeLink>
                {t("privacy.services.sentry")}
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
              {contactEmail ? (
                <ThemeLink href={`mailto:${contactEmail}`} size="3" wrap="wrap">
                  {contactEmail}
                </ThemeLink>
              ) : (
                <Text as="p" size="3" color="gray">
                  {t("privacy.contact.pending")}
                </Text>
              )}
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
