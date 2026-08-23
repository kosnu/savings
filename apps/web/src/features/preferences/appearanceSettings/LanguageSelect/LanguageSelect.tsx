import { ExclamationTriangleIcon } from "@radix-ui/react-icons"
import { Callout, Flex, Select, Text } from "@radix-ui/themes"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"

import { appLanguageLabelKeys, appLanguages, toAppLanguage } from "../../../../i18n"
import { useSupabaseSession } from "../../../../providers/supabase/useSupabaseSession"
import { isLanguageUpdateWriteFailure, useUpdateLanguage } from "../../../profile"

const selectId = "appearance-language"

export function LanguageSelect() {
  const { i18n, t } = useTranslation()
  const { session } = useSupabaseSession()
  const authUserId = session?.user.id
  const { updateLanguage, isPending } = useUpdateLanguage(authUserId ?? "")
  const [writeFailed, setWriteFailed] = useState(false)
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
  return (
    <Flex direction="column" gap="2" align="start">
      <Text as="label" htmlFor={selectId} size="2" weight="bold">
        {t("language.label")}
      </Text>
      <Select.Root
        size="2"
        value={value}
        onValueChange={(nextLanguage) => void handleValueChange(nextLanguage)}
        disabled={isPending}
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
    </Flex>
  )
}
