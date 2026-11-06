import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Button, Callout, Dialog, Flex, Heading, Link, Skeleton, Text } from "@radix-ui/themes"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  createDeletionReceipt,
  deletionReceiptEvent,
  prepareAccountDeletion,
  requestAccountDeletion,
  type DeletionPreview,
  type DeletionReceipt,
} from "../../../../lib/accountDeletion"
import { getSupabaseClient } from "../../../../lib/supabase"
import { deletionTime } from "../deletionTime"

export function DeleteAccount({ receipt }: { receipt?: DeletionReceipt }) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState<DeletionPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)

  // 確認画面を開くたび説明を取得し、通常データのquery cacheへ残さない。
  const load = async () => {
    setBusy(true)
    setError(false)
    setPreview(null)
    try {
      const next = await prepareAccountDeletion()
      if (receipt && receipt.authUserId !== next.auth_user_id)
        throw new Error("Account identity mismatch")
      setPreview(next)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }
  const confirm = async () => {
    if (!preview || !preview.accepting_requests || busy) return
    setBusy(true)
    setError(false)
    try {
      const requestReceipt = receipt ?? createDeletionReceipt(preview.auth_user_id)
      // 送信直前から保護画面を隠し、commit応答喪失も結果照会へ渡す。
      window.dispatchEvent(new Event(deletionReceiptEvent))
      try {
        await requestAccountDeletion(requestReceipt, preview.explanation_version)
      } catch {
        /* 成否は独立した匿名照会で確定する。別番号で再送しない。 */
      }
      try {
        const client = getSupabaseClient()
        const { data } = await client.auth.getSession()
        if (data.session?.user.id === requestReceipt.authUserId)
          await client.auth.signOut({ scope: "local" })
      } catch {
        /* 結果画面に端末内消去の再試行を残す。 */
      }
      window.location.assign("/account-deletion")
    } catch {
      setError(true)
      setBusy(false)
    }
  }

  return (
    <Flex direction="column" gap="3">
      <Heading as="h2" size="4">
        {t("deletion.heading")}
      </Heading>
      <Text as="p" size="2">
        {t("deletion.introduction")}
      </Text>
      <Dialog.Root
        open={open}
        onOpenChange={(value) => {
          if (!busy || !preview) setOpen(value)
        }}
      >
        <Dialog.Trigger>
          <Button
            color="red"
            variant="soft"
            onClick={() => {
              void load()
            }}
          >
            {t(receipt ? "deletion.retryRequest" : "deletion.open")}
          </Button>
        </Dialog.Trigger>
        <Dialog.Content
          maxWidth="600px"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            cancelRef.current?.focus()
          }}
          onEscapeKeyDown={(event) => {
            if (busy && preview) event.preventDefault()
          }}
        >
          <Dialog.Title>{t("deletion.confirmTitle")}</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            {t("deletion.introduction")}
          </Dialog.Description>
          <Flex direction="column" gap="3">
            {busy && !preview && (
              <output aria-label={t("common.loading")}>
                <Flex direction="column" gap="3">
                  <Skeleton height="24px" width="60%" />
                  <Skeleton height="80px" />
                  <Skeleton height="24px" width="80%" />
                </Flex>
              </output>
            )}
            {error && (
              <Callout.Root color="red" variant="surface" size="1" role="alert">
                <Callout.Icon>
                  <ExclamationTriangleIcon />
                </Callout.Icon>
                <Callout.Text>{t("deletion.prepareError")}</Callout.Text>
              </Callout.Root>
            )}
            {preview && (
              <>
                <Text as="p" weight="bold">
                  {preview.email}
                </Text>
                <Text as="p" size="2">
                  {t("deletion.scope", {
                    sole: preview.sole_book_count,
                    shared: preview.shared_book_count,
                  })}
                </Text>
                <Text as="p" size="2">
                  {t("deletion.shared")}
                </Text>
                <Text as="p" size="2">
                  {t("deletion.restore")}
                </Text>
                <Text as="p" size="2">
                  {t("deletion.retention")}
                </Text>
                <Text as="p" size="2">
                  {t("deletion.estimate")}
                </Text>
                <Text as="p" size="2">
                  {t("deletion.deadline")}: {deletionTime(preview.delete_after, i18n.language)}
                </Text>
                <Text as="p" size="2">
                  {t("deletion.purgeAfter")}: {deletionTime(preview.purge_after, i18n.language)}
                </Text>
                {!preview.accepting_requests && (
                  <Text color="gray">{t("deletion.unavailable")}</Text>
                )}
                <Link href="/privacy" target="_blank" rel="noreferrer">
                  {t("privacy.title")}
                </Link>
              </>
            )}
            <Flex justify="end" gap="3" wrap="wrap" mt="3">
              <Dialog.Close>
                <Button
                  ref={cancelRef}
                  type="button"
                  color="gray"
                  variant="soft"
                  disabled={busy && !!preview}
                >
                  {t("common.cancel")}
                </Button>
              </Dialog.Close>
              {error && (
                <Button
                  variant="soft"
                  disabled={busy}
                  onClick={() => {
                    void load()
                  }}
                >
                  {t("common.retry")}
                </Button>
              )}
              {preview && (
                <Button
                  type="button"
                  color="red"
                  variant="solid"
                  disabled={!preview.accepting_requests || busy}
                  loading={busy}
                  onClick={() => {
                    void confirm()
                  }}
                >
                  {t("deletion.confirm")}
                </Button>
              )}
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
      <Link href="/account-deletion" size="2">
        {t("deletion.resultLink")}
      </Link>
    </Flex>
  )
}
