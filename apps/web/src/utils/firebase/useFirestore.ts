import { useContext } from "react"
import { FirestoreContext } from "./firebaseContext"

// Firestore を使うためのカスタムフック
export function useFirestore() {
  const context = useContext(FirestoreContext)
  if (!context) {
    throw new Error("useFirestore must be used within a FirestoreProvider")
  }

  return context
}
