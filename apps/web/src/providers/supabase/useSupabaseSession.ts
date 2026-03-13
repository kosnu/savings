import { use } from "react"

import { SupabaseSessionContext, type SupabaseSessionState } from "./SupabaseSessionProvider"

export function useSupabaseSession(): SupabaseSessionState {
  const context = use(SupabaseSessionContext)
  if (context === undefined) {
    throw new Error("useSupabaseSession must be used within a SupabaseSessionProvider")
  }
  return context
}
