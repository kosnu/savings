import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Button, Callout, Container, Flex, Heading, Link, Text } from "@radix-ui/themes"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

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
  const headingRef = useRef<HTMLHeadingElement>(null)
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
  const [result, setResult] = useState<DeletionResult>(
    initialState?.status === "pending" ? initialState : { status: "not_confirmed" },
  )
  const [busy, setBusy] = useState(!!initial.receipt)
  const [error, setError] = useState(initial.error)
  const [cleanupError, setCleanupError] = useState(false)
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

  const check = async (id: string, key: string, returnFocus = false) =>
    getDeletionResult(id, key)
      .then((next) => {
        if (returnFocus && next.status !== "not_confirmed") headingRef.current?.focus()
        setError(false)
        setResult(next)
        setNow(Date.now())
        if (next.status === "cancelled" || next.status === "completed") {
          const saved = readDeletionReceipt()
          if (saved?.requestId === id && saved.secret === key) clearDeletionReceipt()
        }
      })
      .catch(() => {
        setError(true)
      })
      .finally(() => {
        setBusy(false)
      })
  const cleanup = async (returnFocus = false) => {
    setClearing(true)
    try {
      const { error: signOutError } = await getSupabaseClient().auth.signOut({ scope: "local" })
      if (signOutError) throw signOutError
      if (returnFocus) headingRef.current?.focus()
      setCleanupError(false)
    } catch {
      setCleanupError(true)
    } finally {
      setClearing(false)
    }
  }
  useEffect(() => {
    const receipt = initial.receipt
    if (receipt) void check(receipt.requestId, receipt.secret)
    const cleanupUserId =
      initialState?.status === "pending"
        ? authUserId
        : window.location.pathname === "/account-deletion"
          ? receipt?.authUserId
          : undefined
    if (!cleanupUserId) return
    void getSupabaseClient()
      .auth.getSession()
      .then(
        ({ data, error: sessionError }) => {
          if (sessionError) {
            setCleanupError(true)
            return
          }
          if (data.session?.user.id === cleanupUserId) void cleanup()
        },
        () => {
          setCleanupError(true)
        },
      )
  }, [initial, initialState?.status, authUserId])

  return (
    <main>
      <Container size="2" p="4">
        <Flex direction="column" gap="4">
          <Heading ref={headingRef} tabIndex={-1} as="h1" size="6">
            {t("deletion.statusTitle")}
          </Heading>
          <Text asChild>
            <output>
              {t(
                busy && result.status === "not_confirmed"
                  ? "deletion.checking"
                  : `deletion.state.${result.status}`,
              )}
            </output>
          </Text>
          {result.status === "pending" && (
            <>
              <Text as="p">
                {t("deletion.deadline")}: {deletionTime(result.delete_after, i18n.language)}
              </Text>
              <Text as="p">
                {t("deletion.purgeAfter")}: {deletionTime(result.purge_after, i18n.language)}
              </Text>
              <Text as="p" size="2">
                {t(
                  now < Date.parse(result.delete_after)
                    ? "deletion.grace"
                    : now < Date.parse(result.purge_after)
                      ? "deletion.waiting"
                      : "deletion.delayed",
                )}
              </Text>
            </>
          )}
          {error && (
            <Callout.Root color="red" size="1" variant="surface" role="alert">
              <Callout.Icon>
                <ExclamationTriangleIcon />
              </Callout.Icon>
              <Callout.Text>{t("deletion.lookupError")}</Callout.Text>
            </Callout.Root>
          )}
          {initial.receipt && (error || result.status === "not_confirmed") && (
            <Button
              variant="soft"
              loading={busy}
              disabled={busy}
              onClick={() => {
                if (!initial.receipt) return
                setBusy(true)
                void check(initial.receipt.requestId, initial.receipt.secret, true)
              }}
            >
              {t("common.retry")}
            </Button>
          )}
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
          {(result.status === "not_confirmed" ||
            (result.status === "pending" && now < Date.parse(result.delete_after))) && (
            <>
              {result.status === "not_confirmed" && (
                <Text as="p" size="2">
                  {t("deletion.grace")}
                </Text>
              )}
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
          {cleanupError && (
            <>
              <Text color="red" role="alert">
                {t("deletion.cleanupError")}
              </Text>
              <Button
                color="gray"
                variant="soft"
                loading={clearing}
                disabled={clearing}
                onClick={() => {
                  void cleanup(true)
                }}
              >
                {t("deletion.retryCleanup")}
              </Button>
            </>
          )}
          {!busy &&
            (result.status === "not_confirmed" ||
              error ||
              (result.status === "pending" && now >= Date.parse(result.purge_after))) && (
              <Link href="mailto:support@burneto.com">{t("privacy.contact.title")}</Link>
            )}
          <Link href="/">{t("privacy.back", { appName: t("app.name") })}</Link>
        </Flex>
      </Container>
    </main>
  )
}
