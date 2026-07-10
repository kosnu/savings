import { Button, Container, Flex, Text } from "@radix-ui/themes"
import { useTranslation } from "react-i18next"

import { useAuthCallbackError } from "../../../utils/auth/useAuthCallbackError"
import { useSupabaseSignIn } from "../../../utils/auth/useSupabaseSignIn"

export function AuthPage() {
  const { signIn: signInWithSupabase } = useSupabaseSignIn()
  const authError = useAuthCallbackError(window.location.href)
  const { t } = useTranslation()

  return (
    <Container px="4" size="2">
      <Flex direction="column" gap="3">
        <Text asChild size="5" weight="bold">
          <h2>{t("auth.title")}</h2>
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
        <Flex direction="column" gap="2">
          <Button onClick={signInWithSupabase} variant="outline">
            {t("auth.continueWithGoogle")}
          </Button>
        </Flex>
      </Flex>
    </Container>
  )
}
