import { Button, Container } from "@radix-ui/themes"
import { Paper } from "../../../components/misc/Paper"
import { useSignIn } from "../../../utils/auth/useSignIn"

export function TopPage() {
  const { signIn } = useSignIn()
  return (
    <>
      {/* TODO: ログインしていたらダッシュボードを表示する */}
      <Container size="2">
        <Paper>
          <h2>My Savings</h2>
          <Button onClick={signIn}>ログイン</Button>
        </Paper>
      </Container>
    </>
  )
}
