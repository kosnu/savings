import type { ReactNode } from "react"
import { FirestoreProvider } from "../providers/firebase/FirebaseProvider"
import { SnackbarProvider } from "../providers/snackbar"
import { ThemeProvider } from "../utils/theme/ThemeProvider"

interface ProviderProps {
  children: ReactNode
}

export function Provider({ children }: ProviderProps) {
  return (
    <FirestoreProvider>
      <ThemeProvider>
        <SnackbarProvider>{children}</SnackbarProvider>
      </ThemeProvider>
    </FirestoreProvider>
  )
}
