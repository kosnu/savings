import { Button, Container } from "@radix-ui/themes"
import { useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Paper } from "../../../components/misc/Paper"
import { paths } from "../../../config/paths"
import { signIn } from "../../../utils/auth/signIn"
import { useFirestore } from "../../../utils/firebase"

export function TopPage() {
  const db = useFirestore()
  const navigate = useNavigate()

  const handleSingin = useCallback(async () => {
    try {
      await signIn(db)
      await navigate(paths.payments.getHref())
    } catch (error) {
      console.error(error)
    }
  }, [db, navigate])

  return (
    <>
      {/* TODO: ログインしていたらダッシュボードを表示する */}
      <Container size="2">
        <Paper>
          <h2>My Savings</h2>
          <Button onClick={handleSingin}>ログイン</Button>
        </Paper>
      </Container>
    </>
  )
}
