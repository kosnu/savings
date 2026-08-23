import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Button, Callout, Flex, Select, Text } from "@radix-ui/themes"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"

import { appLanguageLabelKeys, appLanguages, toAppLanguage } from "../../../../i18n"
import { useSupabaseSession } from "../../../../providers/supabase/useSupabaseSession"
import {
  isLanguageUpdateVerificationFailure,
  isLanguageUpdateWriteFailure,
  useUpdateLanguage,
} from "../../../profile"

const selectId = "appearance-language"

export function LanguageSelect() {
  const { i18n, t } = useTranslation()
  const { session } = useSupabaseSession()
  const authUserId = session?.user.id
  const { updateLanguage, retryLanguageVerification, isPending } = useUpdateLanguage(
    authUserId ?? "",
  )
  const [writeFailed, setWriteFailed] = useState(false)
  const [verificationFailed, setVerificationFailed] = useState(false)
  const value = toAppLanguage(i18n.resolvedLanguage)

  const handleValueChange = useCallback(
    async (nextLanguage: string) => {
      const nextAppLanguage = toAppLanguage(nextLanguage)
      if (nextAppLanguage === value) return

      setWriteFailed(false)
      try {
        await i18n.changeLanguage(nextAppLanguage)
        if (authUserId !== undefined) {
          try {
            await updateLanguage(nextAppLanguage)
          } catch (error) {
            if (isLanguageUpdateWriteFailure(error)) {
              setWriteFailed(true)
              await i18n.changeLanguage(value)
            } else if (isLanguageUpdateVerificationFailure(error)) {
              setVerificationFailed(true)
            } else {
              throw error
            }
          }
        }
      } catch {
        await i18n.changeLanguage(value)
      }
    },
    [authUserId, i18n, updateLanguage, value],
  )
  const handleVerificationRetry = useCallback(async () => {
    try {
      await retryLanguageVerification()
      setVerificationFailed(false)
    } catch {
      // 未確認状態と再確認経路を維持する。
    }
  }, [retryLanguageVerification])

  return (
    <Flex direction="column" gap="2" align="start">
      <Text as="label" htmlFor={selectId} size="2" weight="bold">
        {t("language.label")}
      </Text>
      <Select.Root
        size="2"
        value={value}
        onValueChange={(nextLanguage) => void handleValueChange(nextLanguage)}
        disabled={isPending || verificationFailed}
      >
        <Select.Trigger id={selectId} />
        <Select.Content>
          {appLanguages.map((language) => (
            <Select.Item key={language} value={language}>
              {t(appLanguageLabelKeys[language])}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>
      {writeFailed ? (
        <Callout.Root role="alert" color="red" variant="surface" size="1">
          <Callout.Icon>
            <ExclamationTriangleIcon />
          </Callout.Icon>
          <Callout.Text>{t("language.saveError")}</Callout.Text>
        </Callout.Root>
      ) : null}
      {verificationFailed ? (
        <Flex direction="column" gap="2" align="start">
          <Callout.Root role="alert" color="red" variant="surface" size="1">
            <Callout.Icon>
              <ExclamationTriangleIcon />
            </Callout.Icon>
            <Callout.Text>{t("language.verificationError")}</Callout.Text>
          </Callout.Root>
          <Button
            type="button"
            variant="soft"
            size="2"
            loading={isPending}
            onClick={() => void handleVerificationRetry()}
          >
            {t("language.retryVerification")}
          </Button>
        </Flex>
      ) : null}
    </Flex>
  )
}
