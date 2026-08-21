import { Flex, Select, Text } from "@radix-ui/themes"
import { useCallback } from "react"
import { useTranslation } from "react-i18next"

import { appLanguageLabelKeys, appLanguages, toAppLanguage } from "../../../../i18n"
import { useSupabaseSession } from "../../../../providers/supabase/useSupabaseSession"
import { useUpdateLanguage } from "../../../profile/profileSettings/useUpdateLanguage"

const selectId = "appearance-language"

export function LanguageSelect() {
  const { i18n, t } = useTranslation()
  const { session } = useSupabaseSession()
  const authUserId = session?.user.id
  const { updateLanguage, isPending } = useUpdateLanguage(authUserId ?? "")
  const value = toAppLanguage(i18n.resolvedLanguage)

  const handleValueChange = useCallback(
    async (nextLanguage: string) => {
      const nextAppLanguage = toAppLanguage(nextLanguage)
      if (nextAppLanguage === value) return

      try {
        await i18n.changeLanguage(nextAppLanguage)
        if (authUserId !== undefined) {
          await updateLanguage(nextAppLanguage)
        }
      } catch {
        await i18n.changeLanguage(value)
      }
    },
    [authUserId, i18n, updateLanguage, value],
  )

  return (
    <Flex direction="column" gap="1" align="start">
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
    </Flex>
  )
}
