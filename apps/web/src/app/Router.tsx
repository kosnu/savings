import { RouterProvider } from "@tanstack/react-router"
import { useEffect } from "react"

import { useSupabaseSession } from "../providers/supabase"
import { router } from "./routes"

export function Router() {
  const { session: supabaseSession, status: authStatus } = useSupabaseSession()

  useEffect(() => {
    void router.invalidate()
  }, [authStatus, supabaseSession])

  return <RouterProvider router={router} context={{ supabaseSession, authStatus }} />
}
