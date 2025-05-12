import type { Firestore } from "firebase/firestore"
import { createContext } from "react"

export const FirestoreContext = createContext<Firestore>(
  null as unknown as Firestore,
)
