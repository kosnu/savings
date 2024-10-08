import { Button, TextField } from "@mui/material"
import { FirebaseError } from "firebase/app"
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth"
import { addDoc, collection } from "firebase/firestore"
import { useCallback } from "react"
import { useFirestore } from "../../../networks/firebase"

export function SignupForm() {
  const db = useFirestore()
  const auth = getAuth()

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const formData = new FormData(event.currentTarget)
      const formJson = Object.fromEntries(formData.entries())
      console.log(formJson)

      signup(formJson.email as string, formJson.password as string)
    },
    [],
  )

  async function signup(email: string, password: string) {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      )
      const user = userCredential.user
      await addDoc(collection(db, "users"), {
        name: user.displayName,
        email: user.email,
        id: user.uid,
      })
    } catch (e) {
      if (e instanceof FirebaseError) {
        console.error(e.code, e.message)
      }
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit}>
        <TextField
          autoFocus
          required
          id="email"
          name="email"
          label="Email"
          type="email"
          fullWidth
          variant="standard"
        />
        <TextField
          autoFocus
          required
          id="password"
          name="password"
          label="Password"
          type="password"
          fullWidth
          variant="standard"
        />
        <Button type="submit">Register</Button>
      </form>
    </>
  )
}
