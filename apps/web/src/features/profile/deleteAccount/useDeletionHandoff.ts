import { useCallback, useEffect, useRef, useState } from "react"

import { i18next } from "../../../i18n"
import {
  getDeletionResult,
  type DeletionRequestResult,
  type DeletionSubmission,
} from "../../../lib/accountDeletion"
import { getSupabaseClient } from "../../../lib/supabase"
import { useSnackbar } from "../../../providers/snackbar/SnackbarProvider"

type Failure = {
  message:
    | "deletion.state.not_confirmed"
    | "deletion.cleanupError"
    | "deletion.unavailable"
    | "deletion.explanationChanged"
    | "deletion.sessionError"
  label: "deletion.recheck" | "deletion.retryCleanup" | "deletion.checkAccount"
  retry: () => void
}

export interface DeletionHandoffOptions {
  authUserId: string
  submission?: DeletionSubmission
  onSignedOut: () => void
  onCheckSession: () => void
}

export function useDeletionHandoff({
  authUserId,
  submission,
  onSignedOut,
  onCheckSession,
}: DeletionHandoffOptions) {
  const { openSnackbar } = useSnackbar()
  const [failure, setFailure] = useState<Failure | null>(null)
  const notified = useRef(false)

  const signOut = useCallback(
    async function finishSignOut(isActive: () => boolean, notifyAcceptance: boolean) {
      if (!isActive()) return
      try {
        const { auth } = getSupabaseClient()
        const { data, error } = await auth.getSession()
        if (error) throw error
        if (!isActive() || (data.session && data.session.user.id !== authUserId)) return
        setFailure(null)
        if (notifyAcceptance && !notified.current) {
          notified.current = true
          openSnackbar("success", i18next.t("deletion.state.pending"))
        }
        if (data.session) {
          const { error: signOutError } = await auth.signOut({ scope: "local" })
          if (signOutError) throw signOutError
        }
        if (isActive()) onSignedOut()
      } catch {
        if (isActive())
          setFailure({
            message: "deletion.cleanupError",
            label: "deletion.retryCleanup",
            retry: () => {
              if (!isActive()) return
              setFailure(null)
              void finishSignOut(isActive, notifyAcceptance)
            },
          })
      }
    },
    [authUserId, onSignedOut, openSnackbar],
  )

  const handleResult = useCallback(
    async (
      result: Exclude<DeletionRequestResult, { status: "not_confirmed" }>,
      isActive: () => boolean,
    ) => {
      if (!isActive()) return
      switch (result.status) {
        case "pending":
        case "completed":
          await signOut(isActive, result.status === "pending")
          break
        case "cancelled":
          onCheckSession()
          break
        case "rejected":
          if (result.reason === "pending") {
            onCheckSession()
            break
          }
          setFailure({
            message: (
              {
                unavailable: "deletion.unavailable",
                explanation: "deletion.explanationChanged",
                session: "deletion.sessionError",
              } as const
            )[result.reason],
            label: "deletion.checkAccount",
            retry: onCheckSession,
          })
      }
    },
    [onCheckSession, signOut],
  )

  const recheck = useCallback(
    async function checkReceipt(isActive: () => boolean) {
      if (!isActive() || !submission) return
      const { requestId, secret } = submission.receipt
      const result = await getDeletionResult(requestId, secret).catch(
        () => ({ status: "not_confirmed" }) as const,
      )
      if (!isActive()) return
      setFailure(null)
      if (result.status === "not_confirmed") {
        setFailure({
          message: "deletion.state.not_confirmed",
          label: "deletion.recheck",
          retry: () => {
            if (!isActive()) return
            setFailure(null)
            void checkReceipt(isActive)
          },
        })
        return
      }
      await handleResult(result, isActive)
    },
    [submission, handleResult],
  )

  const start = useCallback(
    async (isActive: () => boolean) => {
      await (submission?.result ?? Promise.resolve(null))
        .catch((): DeletionRequestResult => ({ status: "not_confirmed" }))
        .then(async (result) => {
          if (!isActive()) return
          if (!result) await signOut(isActive, false)
          else if (result.status === "not_confirmed") await recheck(isActive)
          else await handleResult(result, isActive)
        })
    },
    [submission, signOut, recheck, handleResult],
  )

  useEffect(() => {
    let active = true
    void start(() => active)
    return () => {
      active = false
    }
  }, [start])

  return { failure }
}
