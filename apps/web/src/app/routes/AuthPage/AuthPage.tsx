import { Button, Container, Flex, Text } from "@radix-ui/themes"
import { Paper } from "../../../components/misc/Paper"
import { useSupabaseSignIn } from "../../../utils/auth/useSupabaseSignIn"

export function AuthPage() {
  const { signIn: signInWithSupabase } = useSupabaseSignIn()

  return (
    <Container size="2">
      <Paper>
        <Flex direction="column" gap="3">
          <Text asChild size="5" weight="bold">
            <h2>Sign in to My Savings</h2>
          </Text>
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
