import type { FirebaseOptions } from "firebase/app"
import type { ReactNode } from "react"
import { env } from "../../config/env"
import { FirestoreContext } from "./firebaseContext"
import { initFirebase } from "./initFirebase"

const config: FirebaseOptions = {
  apiKey: env.FIREBASE_API_KEY,
  authDomain: env.FIREBASE_AUTH_DOMAIN,
  projectId: env.FIREBASE_PROJECT_ID,
  storageBucket: env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID,
  appId: env.FIREBASE_APP_ID,
  measurementId: env.FIREBASE_MEASUREMENT_ID,
}

interface FirestoreProviderProps {
  children: ReactNode
}

export function FirestoreProvider({ children }: FirestoreProviderProps) {
  const { firestore } = initFirebase(config)

  return (
    <FirestoreContext.Provider value={firestore}>
      {children}
    </FirestoreContext.Provider>
  )
}
