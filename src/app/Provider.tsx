import type { ReactNode } from "react"
import { FirestoreProvider } from "../utils/firebase/FirebaseProvider"
import { firebaseConfig } from "../utils/firebase/firebase"
import { ThemeProvider } from "../utils/theme/ThemeProvider"

interface ProviderProps {
  children: ReactNode
}

export function Provider({ children }: ProviderProps) {
  return (
    <>
      <FirestoreProvider options={firebaseConfig}>
        <ThemeProvider>{children}</ThemeProvider>
      </FirestoreProvider>
    </>
  )
}
