import type { FirebaseApp, FirebaseOptions } from "firebase/app"
import { connectAuthEmulator, getAuth } from "firebase/auth"
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore"
import type { ReactNode } from "react"
import { FirestoreContext } from "./firebaseContext"
import { initFirebase } from "./initFirebase"

const testConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
}

interface FirestoreTestProviderProps {
  children: ReactNode
}

export function FiresotreTestProvider({
  children,
}: FirestoreTestProviderProps) {
  const { app, firestore } = initFirebase(testConfig)
  useEmulator(app)

  return (
    <FirestoreContext.Provider value={firestore}>
      {children}
    </FirestoreContext.Provider>
  )
}

function useEmulator(app: FirebaseApp) {
  const auth = getAuth(app)
  const db = getFirestore(app)

  //emulator設定
  connectAuthEmulator(auth, import.meta.env.VITE_FIREBASE_AUTH_DOMAIN)
  const [host, port] = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST.split(":")
  connectFirestoreEmulator(db, host, port)
}
