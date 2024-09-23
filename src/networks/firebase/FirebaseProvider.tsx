import type { Firestore } from "firebase/firestore"
import { type ReactNode, createContext, useContext } from "react"
import { db } from "./firebase"

const FirestoreContext = createContext<Firestore>(null as unknown as Firestore)

interface FirestoreProviderProps {
  children: ReactNode
}

export function FirestoreProvider({ children }: FirestoreProviderProps) {
  return (
    <FirestoreContext.Provider value={db}>{children}</FirestoreContext.Provider>
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
