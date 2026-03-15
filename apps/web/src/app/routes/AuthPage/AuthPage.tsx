import { Button, Container, Flex, Text } from "@radix-ui/themes"

import { Paper } from "../../../components/misc/Paper"
import { useAuthCallbackError } from "../../../utils/auth/useAuthCallbackError"
import { useSupabaseSignIn } from "../../../utils/auth/useSupabaseSignIn"

export function AuthPage() {
  const { signIn: signInWithSupabase } = useSupabaseSignIn()
  const authError = useAuthCallbackError(window.location.href)

  return (
    <Container size="2">
      <Paper>
        <Flex direction="column" gap="3">
          <Text asChild size="5" weight="bold">
            <h2>Sign in to My Savings</h2>
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
                ログインに失敗しました
              </Text>
              <Text size="2">
                認証を完了できませんでした。時間をおいて、もう一度お試しください。
              </Text>
            </Flex>
          )}
          <Flex direction="column" gap="2">
            <Button onClick={signInWithSupabase} variant="outline">
              Continue with Google
            </Button>
          </Flex>
        </Flex>
      </Paper>
    </Container>
  )
}
