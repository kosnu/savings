import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Button, Callout, Container, Flex, Heading, Link, Text, TextField } from "@radix-ui/themes"
import { useEffect, useId, useState } from "react"
import { useTranslation } from "react-i18next"

import { BaseField, FieldLabel } from "../../../../components/inputs/BaseField"
import { startAccountAction } from "../../../../lib/accountAction"
import {
  clearDeletionReceipt,
  getDeletionResult,
  readDeletionReceipt,
  type DeletionResult,
  type MyDeletionState,
} from "../../../../lib/accountDeletion"
import { getSupabaseClient } from "../../../../lib/supabase"
import { DeleteAccount } from "../DeleteAccount"
import { deletionTime } from "../deletionTime"

export function AccountDeletionStatus({
  initialState,
  authUserId,
}: {
  initialState?: MyDeletionState | null
  authUserId?: string
}) {
  const { t, i18n } = useTranslation()
  const requestInputId = useId()
  const secretInputId = useId()
  const [initial] = useState(() => {
    try {
      const receipt = readDeletionReceipt()
      return {
        receipt: receipt && (!authUserId || receipt.authUserId === authUserId) ? receipt : null,
        error: false,
      }
    } catch {
      return { receipt: null, error: true }
    }
  })
  const [requestId, setRequestId] = useState(initial.receipt?.requestId ?? "")
  const [secret, setSecret] = useState(initial.receipt?.secret ?? "")
  const [showSecret, setShowSecret] = useState(false)
  const [result, setResult] = useState<DeletionResult>(
    initialState?.status === "pending" ? initialState : { status: "not_confirmed" },
  )
  const [busy, setBusy] = useState(!!initial.receipt)
  const [error, setError] = useState(false)
  const [cleanupError, setCleanupError] = useState(initial.error)
  const [clearing, setClearing] = useState(false)
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    if (result.status !== "pending") return
    const next = [Date.parse(result.delete_after), Date.parse(result.purge_after)].find(
      (time) => time > now,
    )
    if (next === undefined) return
    const timer = setTimeout(() => setNow(Date.now()), Math.min(next - now, 2_147_483_647))
    return () => clearTimeout(timer)
  }, [result, now])

  const check = async (id: string, key: string) =>
    getDeletionResult(id, key)
      .then((next) => {
        setResult(next)
        setNow(Date.now())
        if (next.status === "cancelled" || next.status === "completed") {
          const saved = readDeletionReceipt()
          if (saved?.requestId === id && saved.secret === key) clearDeletionReceipt()
          setSecret("")
          setShowSecret(false)
        }
      })
      .catch(() => {
        setError(true)
      })
      .finally(() => {
        setBusy(false)
      })
  const cleanup = async () => {
    setClearing(true)
    setCleanupError(false)
    try {
      const { error: signOutError } = await getSupabaseClient().auth.signOut({ scope: "local" })
      if (signOutError) throw signOutError
    } catch {
      setCleanupError(true)
    } finally {
      setClearing(false)
    }
  }
  useEffect(() => {
    const receipt = initial.receipt
    if (!receipt) return
    void check(receipt.requestId, receipt.secret)
    if (window.location.pathname === "/account-deletion") {
      void getSupabaseClient()
        .auth.getSession()
        .then(
          ({ data, error: sessionError }) => {
            if (sessionError) {
              setCleanupError(true)
              return
            }
            if (data.session?.user.id === receipt.authUserId) void cleanup()
          },
          () => {
            setCleanupError(true)
          },
        )
    }
  }, [initial])

  return (
    <main>
      <Container size="2" p="4">
        <Flex direction="column" gap="4">
          <Heading as="h1" size="6">
            {t("deletion.statusTitle")}
          </Heading>
          <Text asChild>
            <output>{t(`deletion.state.${result.status}`)}</output>
          </Text>
          {result.status !== "not_confirmed" && (
            <>
              <Text as="p">
                {t("deletion.deadline")}: {deletionTime(result.delete_after, i18n.language)}
              </Text>
              <Text as="p">
                {t("deletion.purgeAfter")}: {deletionTime(result.purge_after, i18n.language)}
              </Text>
              {result.status === "pending" && (
                <Text as="p" size="2">
                  {t(
                    now < Date.parse(result.delete_after)
                      ? "deletion.grace"
                      : now < Date.parse(result.purge_after)
                        ? "deletion.waiting"
                        : "deletion.delayed",
                  )}
                </Text>
              )}
            </>
          )}
          <Text as="p" size="2">
            {t("deletion.lookupHelp")}
          </Text>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              setBusy(true)
              setError(false)
              void check(requestId, secret)
            }}
          >
            <Flex direction="column" gap="3">
              {error && (
                <Callout.Root color="red" size="1" variant="surface" role="alert">
                  <Callout.Icon>
                    <ExclamationTriangleIcon />
                  </Callout.Icon>
                  <Callout.Text>{t("deletion.lookupError")}</Callout.Text>
                </Callout.Root>
              )}
              <BaseField>
                <FieldLabel htmlFor={requestInputId} required>
                  {t("deletion.requestId")}
                </FieldLabel>
                <TextField.Root
                  id={requestInputId}
                  aria-label={t("deletion.requestId")}
                  value={requestId}
                  disabled={busy}
                  onChange={(event) => setRequestId(event.target.value)}
                  autoComplete="off"
                  required
                />
              </BaseField>
              <BaseField>
                <FieldLabel htmlFor={secretInputId} required>
                  {t("deletion.secret")}
                </FieldLabel>
                <TextField.Root
                  id={secretInputId}
                  aria-label={t("deletion.secret")}
                  value={secret}
                  disabled={busy}
                  onChange={(event) => setSecret(event.target.value)}
                  type={showSecret ? "text" : "password"}
                  autoComplete="off"
                  required
                />
              </BaseField>
              <Button
                type="button"
                variant="ghost"
                color="gray"
                disabled={!secret}
                aria-pressed={showSecret}
                onClick={() => setShowSecret((value) => !value)}
              >
                {t(showSecret ? "deletion.hideSecret" : "deletion.showSecret")}
              </Button>
              <Flex justify="end" mt="4">
                <Button
                  type="submit"
                  variant="solid"
                  loading={busy}
                  disabled={busy || !requestId || !secret}
                >
                  {t("deletion.check")}
                </Button>
              </Flex>
            </Flex>
          </form>
          {initialState?.status === "active" &&
            initial.receipt?.authUserId === authUserId &&
            result.status === "not_confirmed" && (
              <>
                <Text as="p" size="2">
                  {t("deletion.retryRequestHelp")}
                </Text>
                <DeleteAccount receipt={initial.receipt ?? undefined} />
              </>
            )}
          {result.status !== "completed" && result.status !== "cancelled" && (
            <>
              <Text as="p" size="2">
                {t("deletion.loginWarning")}
              </Text>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setBusy(true)
                  setError(false)
                  void startAccountAction(authUserId).catch(() => {
                    setError(true)
                    setBusy(false)
                  })
                }}
              >
                {t("deletion.reactivate")}
              </Button>
            </>
          )}
          <Text as="p" size="2">
            {t("deletion.localCleanup")}
          </Text>
          {cleanupError && (
            <Text color="red" role="alert">
              {t("deletion.cleanupError")}
            </Text>
          )}
          <Button
            color="gray"
            variant="soft"
            loading={clearing}
            disabled={clearing}
            onClick={() => {
              void cleanup()
            }}
          >
            {t("deletion.retryCleanup")}
          </Button>
          <Link href="mailto:support@burneto.com">{t("privacy.contact.title")}</Link>
          <Link href="/">{t("privacy.back", { appName: t("app.name") })}</Link>
        </Flex>
      </Container>
    </main>
  )
}
