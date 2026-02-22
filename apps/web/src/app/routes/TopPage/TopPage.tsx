import { Button, Container, Flex } from "@radix-ui/themes"
import { Link } from "react-router-dom"
import { Paper } from "../../../components/misc/Paper"
import { paths } from "../../../config/paths"
import { useSignIn } from "../../../utils/auth/useSignIn"

export function TopPage() {
  const { signIn } = useSignIn()
  return (
    <>
      {/* TODO: ログインしていたらダッシュボードを表示する */}
      <Container size="2">
        <Paper>
          <h2>My Savings</h2>
          <Flex direction="column" gap="2">
            <Button onClick={signIn}>Firebase でログイン</Button>
            <Button asChild variant="outline">
              <Link to={paths.auth.getHref()}>ほかの認証方法を使う</Link>
            </Button>
          </Flex>
        </Paper>
      </Container>
    </>
  )
}
