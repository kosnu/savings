import { QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { createQueryClient } from "../lib/queryClient"
import { FirestoreProvider } from "../providers/firebase/FirebaseProvider"
import { SnackbarProvider } from "../providers/snackbar"
import { ThemeProvider } from "../providers/theme/ThemeProvider"

const queryClient = createQueryClient()

interface ProviderProps {
  children: ReactNode
}

export function Provider({ children }: ProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <FirestoreProvider>
        <ThemeProvider>
          <SnackbarProvider>{children}</SnackbarProvider>
        </ThemeProvider>
      </FirestoreProvider>
    </QueryClientProvider>
  )
}
