import type { FirebaseOptions } from "firebase/app"
import type { ReactNode } from "react"
import { FirestoreContext } from "./firebaseContext"
import { initFirebase } from "./initFirebase"

const config: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
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
