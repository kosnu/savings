import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Button, Callout, Container, Flex, Link, Spinner } from "@radix-ui/themes"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  clearDeletionReceipt,
  getDeletionResult,
  readDeletionReceipt,
  type DeletionReceipt,
  type DeletionResult,
  type MyDeletionState,
} from "../../../../lib/accountDeletion"
import { getSupabaseClient } from "../../../../lib/supabase"
import { useSnackbar } from "../../../../providers/snackbar/SnackbarProvider"
import { DeleteAccount } from "../DeleteAccount"

type Step =
  | { kind: "checking" }
  | {
      kind: "signingOut" | "retryingSignOut" | "signOutFailed"
      requestId?: string
      accepted: boolean
    }
  | { kind: "unconfirmed"; retryReceipt?: DeletionReceipt; signIn?: boolean }

export function DeletionHandoff({
  authUserId,
  initialState,
  submission,
  onSignedOut,
}: {
  authUserId: string
  initialState: MyDeletionState | null
  submission?: Promise<DeletionResult>
  onSignedOut: () => void
}) {
  const { t } = useTranslation()
  const { openSnackbar } = useSnackbar()
  const [step, setStep] = useState<Step>({ kind: "checking" })
  const [lookupAttempt, setLookupAttempt] = useState(0)

  useEffect(() => {
    let active = true
    const check = async () => {
      let result = await submission
      if (!active) return
      if (!submission && initialState?.status === "pending") {
        setStep({ kind: "signingOut", requestId: initialState.request_id, accepted: true })
        return
      }
      const saved = readDeletionReceipt()
      const receipt = saved?.authUserId === authUserId ? saved : null
      if ((!result || result.status === "not_confirmed") && receipt) {
        result = await getDeletionResult(receipt.requestId, receipt.secret)
      }
      if (!active) return
      if (result?.status === "cancelled") {
        if (receipt && readDeletionReceipt()?.requestId === receipt.requestId)
          clearDeletionReceipt()
        window.location.replace("/")
        return
      }
      if (result?.status === "pending" || result?.status === "completed") {
        setStep({
          kind: "signingOut",
          requestId: receipt?.requestId,
          accepted: result.status === "pending",
        })
        return
      }
      const { data, error } = await getSupabaseClient().auth.getSession()
      if (active) {
        setStep({
          kind: "unconfirmed",
          retryReceipt:
            !error && data.session?.user.id === authUserId ? (receipt ?? undefined) : undefined,
          signIn: !error && !data.session,
        })
      }
    }
    void check().catch(() => {
      if (active) setStep({ kind: "unconfirmed" })
    })
    return () => {
      active = false
    }
  }, [authUserId, initialState, submission, lookupAttempt])

  useEffect(() => {
    if (step.kind !== "signingOut" && step.kind !== "retryingSignOut") return
    let active = true
    const finish = async () => {
      const { auth } = getSupabaseClient()
      const { data, error } = await auth.getSession()
      if (error) throw error
      if (!active || (data.session && data.session.user.id !== authUserId)) return
      const receipt = readDeletionReceipt()
      if (receipt?.authUserId === authUserId && receipt.requestId === step.requestId) {
        clearDeletionReceipt()
        if (step.accepted) openSnackbar("success", t("deletion.state.pending"))
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
              {step.kind === "unconfirmed" && step.retryReceipt && (
                <DeleteAccount
                  receipt={step.retryReceipt}
                  onSubmitted={() => setStep({ kind: "checking" })}
                />
              )}
              {step.kind === "unconfirmed" && step.signIn && (
                <Link href="/auth">{t("auth.login")}</Link>
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
