import type { FirebaseOptions } from "firebase/app"
import type { Firestore } from "firebase/firestore"
import { type ReactNode, createContext, useContext } from "react"
import { initFirebase, useEmulator } from "./firebase"

const FirestoreContext = createContext<Firestore>(null as unknown as Firestore)

interface FirestoreProviderProps {
  options: FirebaseOptions
  children: ReactNode
}

export function FirestoreProvider({
  options,
  children,
}: FirestoreProviderProps) {
  const { firestore } = initFirebase(options)

  return (
    <FirestoreContext.Provider value={firestore}>
      {children}
    </FirestoreContext.Provider>
  )
}

export function FiresotreTestProvider({
  options,
  children,
}: FirestoreProviderProps) {
  const { app, firestore } = initFirebase(options)
  useEmulator(app)

  return (
    <FirestoreContext.Provider value={firestore}>
      {children}
    </FirestoreContext.Provider>
  )
}

// Firestore を使うためのカスタムフック
export function useFirestore() {
  const context = useContext(FirestoreContext)
  if (!context) {
    throw new Error("useFirestore must be used within a FirestoreProvider")
  }

  return context
}
