import { Flex, Spinner, Text } from "@radix-ui/themes"
import { RouterProvider } from "@tanstack/react-router"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"

import { useSupabaseSession } from "../providers/supabase/useSupabaseSession"
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
  const { t } = useTranslation()

  return (
    <Flex align="center" direction="column" gap="3" justify="center" minHeight="100vh">
      <Spinner size="3" />
      <Text color="gray" size="2">
        {t("auth.loading")}
      </Text>
    </Flex>
  )
}
