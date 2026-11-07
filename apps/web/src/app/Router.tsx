import { Flex, Text } from "@radix-ui/themes"
import { RouterProvider } from "@tanstack/react-router"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import { Logo } from "../components/misc/Logo"
import { useSupabaseSession } from "../providers/supabase/useSupabaseSession"
import { router } from "./routes"
import { SessionError } from "./SessionError"
import { usePageMetadata } from "./usePageMetadata"

export function Router() {
  const auth = useSupabaseSession()
  const { session: supabaseSession, status: authStatus } = auth
  const contentRef = useRef<HTMLDivElement>(null)
  const recoveringRef = useRef(false)
  usePageMetadata(router, authStatus === "authenticated")

  useEffect(() => {
    if (authStatus === "error") {
      recoveringRef.current = true
    } else if (authStatus !== "loading" && recoveringRef.current) {
      recoveringRef.current = false
      contentRef.current?.focus({ preventScroll: true })
    }
  }, [authStatus])

  useEffect(() => {
    if (authStatus === "loading" || authStatus === "error") return
    void router.invalidate()
  }, [authStatus, supabaseSession?.user?.id])

  if (authStatus === "loading") {
    return <AuthLoadingScreen />
  }

  if (auth.status === "error") {
    return <SessionError onRetry={auth.retry} requiresSignIn={auth.requiresSignIn} />
  }

  return (
    <div ref={contentRef} tabIndex={-1}>
      <RouterProvider router={router} context={{ supabaseSession, authStatus }} />
    </div>
  )
}

function AuthLoadingScreen() {
  const { t } = useTranslation()

  return (
    <Flex align="center" direction="column" gap="3" justify="center" minHeight="100vh" asChild>
      <output aria-live="polite">
        <Logo width={96} height={96} animated alt="" />
        <Text color="gray" size="2">
          {t("auth.loading")}
        </Text>
      </output>
    </Flex>
  )
}
