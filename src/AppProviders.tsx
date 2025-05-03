import type { ReactNode } from "react"
import { FirestoreProvider } from "./utils/firebase"
import { ThemeProvider } from "./utils/theme/ThemeProvider"

interface AppProvidersProps {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <>
      <FirestoreProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </FirestoreProvider>
    </>
  )
}
