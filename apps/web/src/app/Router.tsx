import { RouterProvider } from "@tanstack/react-router"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import { DeletionHandoff } from "../features/profile"
import { useSnackbar } from "../providers/snackbar/SnackbarProvider"
import { useSupabaseSession } from "../providers/supabase/useSupabaseSession"
import { AuthLoadingScreen } from "./AuthLoadingScreen"
import { router } from "./routes"
import { SessionError } from "./SessionError"
import { usePageMetadata } from "./usePageMetadata"

export function Router() {
  const auth = useSupabaseSession()
  const { session: supabaseSession, status: authStatus } = auth
  const contentRef = useRef<HTMLDivElement>(null)
  const suspendedRef = useRef(false)
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
    if (authStatus === "suspended") {
      suspendedRef.current = true
      return
    }
    if (suspendedRef.current && authStatus === "unauthenticated") {
      void router.navigate({ to: "/", replace: true })
    }
    suspendedRef.current = false
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
      <DeletionHandoff
        key={auth.authUserId}
        submission={auth.submission}
        onSignedOut={auth.onSignedOut}
        onCheckSession={auth.onCheckSession}
        authUserId={auth.authUserId}
      />
    )

  return (
    <div ref={contentRef} tabIndex={-1}>
      <RouterProvider router={router} context={{ supabaseSession, authStatus }} />
    </div>
  )
}
