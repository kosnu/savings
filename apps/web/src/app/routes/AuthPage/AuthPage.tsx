import { Button, Container, Flex, Tabs, Text } from "@radix-ui/themes"
import { Paper } from "../../../components/misc/Paper"
import { useSignIn } from "../../../utils/auth/useSignIn"
import { useSupabaseSignIn } from "../../../utils/auth/useSupabaseSignIn"

export function AuthPage() {
  const { signIn: signInWithFirebase } = useSignIn()
  const { signIn: signInWithSupabase } = useSupabaseSignIn()

  return (
    <Container size="2">
      <Paper>
        <Flex direction="column" gap="3">
          <Text size="5" weight="bold">
            認証方法を選択
          </Text>
          <Tabs.Root defaultValue="firebase">
            <Tabs.List>
              <Tabs.Trigger value="firebase">Firebase</Tabs.Trigger>
              <Tabs.Trigger value="supabase">Supabase</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="firebase">
              <Flex direction="column" gap="2" mt="3">
                <Text size="2">既存の Firebase 認証でログインします。</Text>
                <Button onClick={signInWithFirebase}>
                  Firebase でログイン
                </Button>
              </Flex>
            </Tabs.Content>
            <Tabs.Content value="supabase">
              <Flex direction="column" gap="2" mt="3">
                <Text size="2">
                  Supabase の Google 認証を試験的に実行します。
                </Text>
                <Button onClick={signInWithSupabase} variant="outline">
                  Supabase でログイン
                </Button>
              </Flex>
            </Tabs.Content>
          </Tabs.Root>
        </Flex>
      </Paper>
    </Container>
  )
}
