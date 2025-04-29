import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInWithPopup,
} from "firebase/auth"
import type { Firestore } from "firebase/firestore"
import { createUser } from "./createUser"

export async function signIn(db: Firestore) {
  const provider = new GoogleAuthProvider()
  const auth = getAuth()

  // セッション永続性を設定
  await setPersistence(auth, browserLocalPersistence)

  const result = await signInWithPopup(auth, provider)
  if (!result?.user) return

  await createUser({
    db: db,
    value: {
      id: result.user.uid,
      email: result.user.email ?? "",
      name: result.user.displayName ?? "NO NAME",
    },
  })
}
