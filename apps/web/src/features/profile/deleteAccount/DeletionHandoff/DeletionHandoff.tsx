import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Button, Callout, Container, Flex, Spinner } from "@radix-ui/themes"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { getDeletionResult, type DeletionSubmission } from "../../../../lib/accountDeletion"
import { getSupabaseClient } from "../../../../lib/supabase"
import { useSnackbar } from "../../../../providers/snackbar/SnackbarProvider"

type Step =
  | { kind: "checking" | "unconfirmed" }
  | {
      kind: "signingOut" | "retryingSignOut" | "signOutFailed"
      accepted: boolean
    }

export function DeletionHandoff({
  authUserId,
  submission,
  onSignedOut,
}: {
  authUserId: string
  submission?: DeletionSubmission
  onSignedOut: () => void
}) {
  const { t } = useTranslation()
  const { openSnackbar } = useSnackbar()
  const [step, setStep] = useState<Step>(
    submission ? { kind: "checking" } : { kind: "signingOut", accepted: false },
  )
  const notified = useRef(false)
  const [lookupAttempt, setLookupAttempt] = useState(0)

  useEffect(() => {
    if (!submission) return
    let active = true
    const check = async () => {
      let result = await submission.result.catch(() => undefined)
      if (!active) return
      if (!result || result.status === "not_confirmed") {
        const { requestId, secret } = submission.receipt
        result = await getDeletionResult(requestId, secret)
      }
      if (!active) return
      if (result?.status === "cancelled") {
        window.location.replace("/")
        return
      }
      if (result?.status === "pending" || result?.status === "completed") {
        setStep({
          kind: "signingOut",
          accepted: result.status === "pending",
        })
        return
      }
      setStep({ kind: "unconfirmed" })
    }
    void check().catch(() => {
      if (active) setStep({ kind: "unconfirmed" })
    })
    return () => {
      active = false
    }
  }, [submission, lookupAttempt])

  useEffect(() => {
    if (step.kind !== "signingOut" && step.kind !== "retryingSignOut") return
    let active = true
    const finish = async () => {
      const { auth } = getSupabaseClient()
      const { data, error } = await auth.getSession()
      if (error) throw error
      if (!active || (data.session && data.session.user.id !== authUserId)) return
      if (step.accepted && !notified.current) {
        notified.current = true
        openSnackbar("success", t("deletion.state.pending"))
      }
      if (data.session) {
        const { error: signOutError } = await auth.signOut({ scope: "local" })
        if (signOutError) throw signOutError
      }
      if (active) onSignedOut()
    }
    void finish().catch(() => {
      if (active) setStep({ ...step, kind: "signOutFailed" })
    })
    return () => {
      active = false
    }
  }, [authUserId, onSignedOut, openSnackbar, step, t])

  const checkingAgain = step.kind === "checking" && lookupAttempt > 0
  const showLookup = step.kind === "unconfirmed" || checkingAgain
  const showSignOut = step.kind === "signOutFailed" || step.kind === "retryingSignOut"

  return (
    <main>
      <Container size="1" p="4">
        <Flex direction="column" align="center" gap="3">
          {showLookup || showSignOut ? (
            <>
              <Callout.Root role="alert" color="red" variant="surface" size="1">
                <Callout.Icon>
                  <ExclamationTriangleIcon />
                </Callout.Icon>
                <Callout.Text>
                  {t(showLookup ? "deletion.state.not_confirmed" : "deletion.cleanupError")}
                </Callout.Text>
              </Callout.Root>
              {showLookup ? (
                <Button
                  variant="soft"
                  loading={checkingAgain}
                  disabled={checkingAgain}
                  onClick={() => {
                    setStep({ kind: "checking" })
                    setLookupAttempt((count) => count + 1)
                  }}
                >
                  {t("deletion.recheck")}
                </Button>
              ) : (
                <Button
                  variant="soft"
                  loading={step.kind === "retryingSignOut"}
                  disabled={step.kind === "retryingSignOut"}
                  onClick={() => {
                    if (step.kind === "signOutFailed") setStep({ ...step, kind: "retryingSignOut" })
                  }}
                >
                  {t("deletion.retryCleanup")}
                </Button>
              )}
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
