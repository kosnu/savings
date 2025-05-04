import type { ReactNode } from "react"
import { FirestoreProvider } from "../utils/firebase"
import { ThemeProvider } from "../utils/theme/ThemeProvider"

interface ProviderProps {
  children: ReactNode
}

export function Provider({ children }: ProviderProps) {
  return (
    <>
      <FirestoreProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </FirestoreProvider>
    </>
  )
}
