import { RouterProvider } from "@tanstack/react-router"
import { useSupabaseSession } from "../providers/supabase"
import { router } from "./routes"

export function Router() {
  const { session: supabaseSession, loading: supabaseLoading } =
    useSupabaseSession()

  return (
    <RouterProvider
      router={router}
      context={{ supabaseSession, supabaseLoading }}
    />
  )
}
