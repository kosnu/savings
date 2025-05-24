import type { FirebaseApp, FirebaseOptions } from "firebase/app"
import { type Auth, connectAuthEmulator, getAuth } from "firebase/auth"
import {
  type Firestore,
  connectFirestoreEmulator,
  getFirestore,
} from "firebase/firestore"
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
  const { app } = initFirebase(testConfig)
  const { auth, firestore } = useEmulator(app)

  return {
    app: app,
    firestore: firestore,
    auth: auth,
  }
}

interface UseEmulatorReturn {
  auth: Auth
  firestore: Firestore
}

function useEmulator(app: FirebaseApp): UseEmulatorReturn {
  const auth = getAuth(app)
  const firestore = getFirestore(app)

  //emulator設定
  connectAuthEmulator(auth, env.FIREBASE_AUTH_DOMAIN, {
    disableWarnings: true,
  })
  const [host, port] = env.FIRESTORE_EMULATOR_HOST.split(":")
  connectFirestoreEmulator(firestore, host, Number.parseInt(port, 10))

  return {
    auth: auth,
    firestore: firestore,
  }
}
