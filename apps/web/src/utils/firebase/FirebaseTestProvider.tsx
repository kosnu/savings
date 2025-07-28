import type { FirebaseOptions } from "firebase/app"
import type { ReactNode } from "react"
import { env } from "../../config/env"
import { FirestoreContext } from "./firebaseContext"
import { initFirebase } from "./initFirebase"

const testConfig: FirebaseOptions = {
  apiKey: env.FIREBASE_API_KEY,
  authDomain: env.FIREBASE_AUTH_DOMAIN,
  projectId: env.FIREBASE_PROJECT_ID,
}

interface FirestoreTestProviderProps {
  children: ReactNode
}

export function FiresotreTestProvider({
  children,
}: FirestoreTestProviderProps) {
  const { firestore } = initEmulatedFirebase()

  return (
    <FirestoreContext.Provider value={firestore}>
      {children}
    </FirestoreContext.Provider>
  )
}

export function initEmulatedFirebase() {
  // FIXME: テストコードでも `initEmulatedFirebase()` が使われているので、ベースの `initFirebase()` をラップする形にした
  const { app, firestore, auth } = initFirebase(testConfig)

  return {
    app: app,
    firestore: firestore,
    auth: auth,
  }
}
