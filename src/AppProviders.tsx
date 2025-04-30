import { LocalizationProvider } from "@mui/x-date-pickers"
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3"
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
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <ThemeProvider>{children}</ThemeProvider>
        </LocalizationProvider>
      </FirestoreProvider>
    </>
  )
}
