import { Flex, Select, Text } from "@radix-ui/themes"
import { useCallback } from "react"
import { useTranslation } from "react-i18next"

import { appLanguageLabelKeys, appLanguages, toAppLanguage } from "../../../../i18n"
import { useSnackbar } from "../../../../providers/snackbar/SnackbarProvider"
import { useSupabaseSession } from "../../../../providers/supabase/useSupabaseSession"
import { useLanguagePreference } from "../../languagePreference/useLanguagePreference"
import { useUpdateLanguagePreference } from "../../languagePreference/useUpdateLanguagePreference"

const selectId = "appearance-language"

export function LanguageSelect() {
  const { i18n, t } = useTranslation()
  const { openSnackbar } = useSnackbar()
  const { status, session } = useSupabaseSession()
  const authUserId = status === "authenticated" ? (session?.user.id ?? null) : null
  const { isPending: isLanguagePending } = useLanguagePreference(authUserId)
  const { updateLanguagePreference, isPending: isSavePending } = useUpdateLanguagePreference(
    authUserId ?? "unauthenticated",
  )
  const value = toAppLanguage(i18n.resolvedLanguage)

  const handleValueChange = useCallback(
    async (nextLanguage: string) => {
      const language = toAppLanguage(nextLanguage)
      if (!authUserId || language === value) return

      try {
        const confirmedLanguage = await updateLanguagePreference(language)
        await i18n.changeLanguage(confirmedLanguage)
        openSnackbar("success", i18n.t("language.saveSuccess"))
      } catch {
        openSnackbar("error", t("language.saveError"))
      }
    },
    [authUserId, i18n, openSnackbar, t, updateLanguagePreference, value],
  )

  return (
    <Flex direction="column" gap="1" align="start">
      <Text as="label" htmlFor={selectId} size="2" weight="bold">
        {t("language.label")}
      </Text>
      <Select.Root
        disabled={!authUserId || isLanguagePending || isSavePending}
        size="2"
        value={value}
        onValueChange={(nextLanguage) => void handleValueChange(nextLanguage)}
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
