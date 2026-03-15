import { RouterProvider } from "@tanstack/react-router"
import { useEffect } from "react"

import { useSupabaseSession } from "../providers/supabase"
import { router } from "./routes"

export function Router() {
  const { session: supabaseSession, loading: supabaseLoading } = useSupabaseSession()

  useEffect(() => {
    void router.invalidate()
  }, [supabaseLoading, supabaseSession])

  return <RouterProvider router={router} context={{ supabaseSession, supabaseLoading }} />
}
