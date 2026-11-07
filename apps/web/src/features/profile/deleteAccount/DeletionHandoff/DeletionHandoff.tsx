import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Button, Callout, Container, Flex, Spinner } from "@radix-ui/themes"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { i18next } from "../../../../i18n"
import {
  getDeletionResult,
  type DeletionRequestResult,
  type DeletionSubmission,
} from "../../../../lib/accountDeletion"
import { getSupabaseClient } from "../../../../lib/supabase"
import { useSnackbar } from "../../../../providers/snackbar/SnackbarProvider"

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

export function DeletionHandoff({
  authUserId,
  submission,
  onSignedOut,
  onCheckSession,
}: {
  authUserId: string
  submission?: DeletionSubmission
  onSignedOut: () => void
  onCheckSession: () => void
}) {
  const { t } = useTranslation()
  const { openSnackbar } = useSnackbar()
  const [failure, setFailure] = useState<Failure | null>(null)
  const notified = useRef(false)

  useEffect(() => {
    let active = true

    const signOut = async (notifyAcceptance: boolean) => {
      if (!active) return
      setFailure(null)
      try {
        const { auth } = getSupabaseClient()
        const { data, error } = await auth.getSession()
        if (error) throw error
        if (!active || (data.session && data.session.user.id !== authUserId)) return
        if (notifyAcceptance && !notified.current) {
          notified.current = true
          openSnackbar("success", i18next.t("deletion.state.pending"))
        }
        if (data.session) {
          const { error: signOutError } = await auth.signOut({ scope: "local" })
          if (signOutError) throw signOutError
        }
        if (active) onSignedOut()
      } catch {
        if (active)
          setFailure({
            message: "deletion.cleanupError",
            label: "deletion.retryCleanup",
            retry: () => {
              void signOut(notifyAcceptance)
            },
          })
      }
    }

    const showResult = async (result: DeletionRequestResult) => {
      if (!active) return
      switch (result.status) {
        case "pending":
        case "completed":
          await signOut(result.status === "pending")
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
          break
        case "not_confirmed":
          setFailure({
            message: "deletion.state.not_confirmed",
            label: "deletion.recheck",
            retry: () => {
              void recheck()
            },
          })
      }
    }

    const recheck = async () => {
      if (!active || !submission) return
      setFailure(null)
      try {
        const { requestId, secret } = submission.receipt
        await showResult(await getDeletionResult(requestId, secret))
      } catch {
        await showResult({ status: "not_confirmed" })
      }
    }

    const start = async () => {
      if (!submission) {
        await signOut(false)
        return
      }
      const result = await submission.result.catch((): DeletionRequestResult => ({
        status: "not_confirmed",
      }))
      if (!active) return
      if (result.status === "not_confirmed") await recheck()
      else await showResult(result)
    }
    void start()
    return () => {
      active = false
    }
  }, [authUserId, submission, onSignedOut, onCheckSession, openSnackbar])

  return (
    <main>
      <Container size="1" p="4">
        <Flex direction="column" align="center" gap="3">
          {failure ? (
            <>
              <Callout.Root role="alert" color="red" variant="surface" size="1">
                <Callout.Icon>
                  <ExclamationTriangleIcon />
                </Callout.Icon>
                <Callout.Text>{t(failure.message)}</Callout.Text>
              </Callout.Root>
              <Button variant="soft" onClick={failure.retry}>
                {t(failure.label)}
              </Button>
            </>
          ) : (
            <output aria-label={t("common.loading")}>
              <Spinner />
            </output>
          )}
        </Flex>
      </Container>
    </main>
  )
}
