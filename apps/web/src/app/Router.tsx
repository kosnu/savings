import { Flex, Spinner, Text } from "@radix-ui/themes"
import { RouterProvider } from "@tanstack/react-router"
import { useEffect } from "react"

import { useSupabaseSession } from "../providers/supabase"
import { router } from "./routes"

export function Router() {
  const { session: supabaseSession, status: authStatus } = useSupabaseSession()

  useEffect(() => {
    if (authStatus === "loading") return
    void router.invalidate()
  }, [authStatus, supabaseSession?.user?.id])

  if (authStatus === "loading") {
    return <AuthLoadingScreen />
  }

  return <RouterProvider router={router} context={{ supabaseSession, authStatus }} />
}

function AuthLoadingScreen() {
  return (
    <Flex align="center" direction="column" gap="3" justify="center" minHeight="100vh">
      <Spinner size="3" />
      <Text color="gray" size="2">
        認証状態を確認しています...
      </Text>
    </Flex>
  )
}
