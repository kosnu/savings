import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  signInWithRedirect,
} from "firebase/auth"
import type { Firestore } from "firebase/firestore"
import { createUser } from "./createUser"

export async function signIn(db: Firestore) {
  const provider = new GoogleAuthProvider()
  const auth = getAuth()
  auth.onAuthStateChanged(async (user) => {
    if (user) {
    } else {
      await signInWithRedirect(auth, provider)
      const result = await getRedirectResult(auth)
      const user = result?.user
      if (!user) return

      await createUser({
        db: db,
        value: {
          id: user.uid,
          email: user.email ?? "",
          name: user.displayName ?? "NO NAME",
        },
      })
    }
  })
}
