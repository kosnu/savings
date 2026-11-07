import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Button, Callout, Dialog, Flex, Heading, Skeleton, Text } from "@radix-ui/themes"
import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { deletionTime } from "../deletionTime"
import { useDeleteAccount } from "../useDeleteAccount"

export function DeleteAccount({ headingLevel = "h2" }: { headingLevel?: "h2" | "h3" }) {
  const { t, i18n } = useTranslation()
  const { preview, error, isPreparing, isSubmitting, prepare, cancelPreparation, confirm } =
    useDeleteAccount()
  const [open, setOpen] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)

  return (
    <Flex direction="column" gap="3">
      <Heading as={headingLevel} size="4">
        {t("deletion.heading")}
      </Heading>
      <Text as="p" size="2">
        {t("deletion.introduction")}
      </Text>
      <Dialog.Root
        open={open}
        onOpenChange={(value) => {
          if (isSubmitting) return
          setOpen(value)
          if (value) void prepare()
          else cancelPreparation()
        }}
      >
        <Dialog.Trigger>
          <Button color="red" variant="soft">
            {t("deletion.open")}
          </Button>
        </Dialog.Trigger>
        <Dialog.Content
          maxWidth="600px"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            cancelRef.current?.focus()
          }}
          onEscapeKeyDown={(event) => {
            if (isSubmitting) event.preventDefault()
          }}
        >
          <Dialog.Title>{t("deletion.confirmTitle")}</Dialog.Title>
          <Dialog.Description size="2" mb="4">
            {t("deletion.introduction")}
          </Dialog.Description>
          <Flex direction="column" gap="3">
            {isPreparing && (
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
                  {t("deletion.scope")}
                </Text>
                <Text as="p" size="2">
                  {t("deletion.shared")}
                </Text>
                <Text as="p" size="2">
                  {t("deletion.restore")}
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
              </>
            )}
            <Flex justify="end" gap="3" wrap="wrap" mt="3">
              <Dialog.Close>
                <Button
                  ref={cancelRef}
                  type="button"
                  color="gray"
                  variant="soft"
                  disabled={isSubmitting}
                >
                  {t("common.cancel")}
                </Button>
              </Dialog.Close>
              {error && (
                <Button
                  variant="soft"
                  disabled={isPreparing || isSubmitting}
                  onClick={() => {
                    void prepare()
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
                  disabled={!preview.accepting_requests || isSubmitting}
                  loading={isSubmitting}
                  onClick={confirm}
                >
                  {t("deletion.confirm")}
                </Button>
              )}
            </Flex>
          </Flex>
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  )
}
