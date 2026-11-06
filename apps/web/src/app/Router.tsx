import { Flex, Spinner, Text } from "@radix-ui/themes"
import { RouterProvider } from "@tanstack/react-router"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import { AccountDeletionStatus } from "../features/profile"
import { useSnackbar } from "../providers/snackbar/SnackbarProvider"
import { useSupabaseSession } from "../providers/supabase/useSupabaseSession"
import { router } from "./routes"
import { SessionError } from "./SessionError"
import { usePageMetadata } from "./usePageMetadata"

export function Router() {
  const auth = useSupabaseSession()
  const { session: supabaseSession, status: authStatus } = auth
  const contentRef = useRef<HTMLDivElement>(null)
  const recoveringRef = useRef(false)
  const { openSnackbar } = useSnackbar()
  const { t } = useTranslation()
  const reactivated = auth.status === "authenticated" && auth.reactivated
  useEffect(() => {
    if (reactivated) openSnackbar("success", t("deletion.state.cancelled"))
  }, [reactivated, openSnackbar, t])
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
  if (auth.status === "suspended")
    return (
      <AccountDeletionStatus
        key={auth.authUserId}
        initialState={auth.deletion}
        authUserId={auth.authUserId}
      />
    )

  return (
    <div ref={contentRef} tabIndex={-1}>
      <RouterProvider router={router} context={{ supabaseSession, authStatus }} />
    </div>
  )
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
