import type { FirebaseOptions } from "firebase/app"
import type { ReactNode } from "react"
import { firebaseConfig } from "../../config/firebase/default"
import { FirestoreContext } from "./firebaseContext"
import { initFirebase } from "./initFirebase"

interface FirestoreProviderProps {
  children: ReactNode
  config?: FirebaseOptions
}

export function FirestoreProvider({
  children,
  config = firebaseConfig,
}: FirestoreProviderProps) {
  const { firestore } = initFirebase(config)

  return (
    <FirestoreContext.Provider value={firestore}>
      {children}
    </FirestoreContext.Provider>
  )
}
