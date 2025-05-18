import {
  type Auth,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth"
import type { User } from "../../types/user"

export async function signInMockUser(auth: Auth, user: User) {
  const credential = {
    sub: "xxx",
    email: user.email,
    email_verified: true,
  }

  await signInWithCredential(
    auth,
    GoogleAuthProvider.credential(JSON.stringify(credential)),
  )
}
