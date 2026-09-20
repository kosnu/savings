import { Button, Container, Flex, Heading, Link as ThemeLink, Text } from "@radix-ui/themes"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { useAuthCallbackError } from "../../../utils/auth/useAuthCallbackError"
import { useSupabaseSignIn } from "../../../utils/auth/useSupabaseSignIn"

export function AuthPage() {
  const { signIn: signInWithSupabase } = useSupabaseSignIn()
  const authError = useAuthCallbackError(window.location.href)
  const { t } = useTranslation()

  return (
    <main>
      <Container p="4" size="2">
        <Flex direction="column" gap="4">
          <Heading as="h1" size="6">
            {t("auth.title")}
          </Heading>
          <Text as="p" size="3">
            {t("auth.startDescription")}
          </Text>
          {authError && (
            <Flex
              aria-live="polite"
              direction="column"
              gap="1"
              p="3"
              style={{
                border: "1px solid var(--red-7)",
                borderRadius: "var(--radius-3)",
                backgroundColor: "var(--red-2)",
              }}
            >
              <Text color="red" size="3" weight="bold">
                {t("auth.callbackErrorTitle")}
              </Text>
              <Text size="2">{t("auth.callbackErrorDescription")}</Text>
            </Flex>
          )}
          <Flex direction="column" gap="3">
            <Button onClick={signInWithSupabase} variant="outline">
              {t("auth.continueWithGoogle")}
            </Button>
            <ThemeLink asChild size="2">
              <Link to="/privacy">{t("privacy.title")}</Link>
            </ThemeLink>
          </Flex>
        </Flex>
      </Container>
    </main>
  )
}
