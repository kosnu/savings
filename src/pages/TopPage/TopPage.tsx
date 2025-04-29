import { useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { ContainedButton } from "../../components/buttons/ContainedButton"
import { Container } from "../../components/layouts/Container"
import { Paper } from "../../components/misc/Paper"
import { signIn } from "../../utils/auth/signIn"
import { useFirestore } from "../../utils/firebase"

export function TopPage() {
  const db = useFirestore()
  const navigate = useNavigate()

  const handleSingin = useCallback(async () => {
    try {
      await signIn(db)
      await navigate("/payments")
    } catch (error) {
      console.error(error)
    }
  }, [db, navigate])

  return (
    <>
      {/* TODO: ログインしていたらダッシュボードを表示する */}
      <Container size="small">
        <Paper>
          <h2>My Savings</h2>
          <ContainedButton onClick={handleSingin}>ログイン</ContainedButton>
        </Paper>
      </Container>
    </>
  )
}
