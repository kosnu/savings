import { QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

import { createQueryClient } from "../lib/queryClient"
import { SnackbarProvider } from "../providers/snackbar"
import { SupabaseSessionProvider } from "../providers/supabase"
import { ThemeProvider } from "../providers/theme/ThemeProvider"

const queryClient = createQueryClient()

interface ProviderProps {
  children: ReactNode
}

export function Provider({ children }: ProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <SupabaseSessionProvider>
        <ThemeProvider>
          <SnackbarProvider>{children}</SnackbarProvider>
        </ThemeProvider>
      </SupabaseSessionProvider>
    </QueryClientProvider>
  )
}
