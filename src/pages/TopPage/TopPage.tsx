import { Button, Container, Paper, Typography } from "@mui/material"
import { useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useFirestore } from "../../networks/firebase"
import { signIn } from "../../utils/auth/signIn"

export function TopPage() {
  const db = useFirestore()
  const navigate = useNavigate()

  const handleSingin = useCallback(async () => {
    try {
      await signIn(db)
      navigate("/payments")
    } catch (error) {
      console.error(error)
    }
  }, [db, navigate])

  return (
    <>
      {/* TODO: ログインしていたらダッシュボードを表示する */}
      <Container maxWidth="md" sx={{ p: 2 }}>
        <Paper elevation={1} sx={{ p: 4 }}>
          <Typography variant="h2">My Savings</Typography>
          <Button variant="contained" onClick={handleSingin}>
            ログイン
          </Button>
        </Paper>
      </Container>
    </>
  )
}
