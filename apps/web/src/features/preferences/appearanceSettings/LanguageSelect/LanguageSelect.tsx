import { Flex, Select, Text } from "@radix-ui/themes"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"

import { appLanguageLabelKeys, appLanguages, toAppLanguage } from "../../../../i18n"
import { updateAccountLanguage } from "../../../../i18n/accountLanguage"
import { useSnackbar } from "../../../../providers/snackbar/SnackbarProvider"
import { useSupabaseSession } from "../../../../providers/supabase/useSupabaseSession"

const selectId = "appearance-language"

export function LanguageSelect() {
  const { i18n, t } = useTranslation()
  const { openSnackbar } = useSnackbar()
  const { session, status } = useSupabaseSession()
  const [isSaving, setIsSaving] = useState(false)
  const value = toAppLanguage(i18n.resolvedLanguage)

  const handleValueChange = useCallback(
    (nextLanguage: string) => {
      const nextAppLanguage = toAppLanguage(nextLanguage)
      const previousAppLanguage = toAppLanguage(i18n.resolvedLanguage)
      if (isSaving || nextAppLanguage === previousAppLanguage) return

      setIsSaving(true)
      void (async () => {
        try {
          await i18n.changeLanguage(nextAppLanguage)

          const authUserId = status === "authenticated" ? session?.user.id : undefined
          if (!authUserId) {
            throw new Error("Authenticated user is required to save account language.")
          }

          await updateAccountLanguage({
            authUserId,
            language: nextAppLanguage,
          })
        } catch {
          await i18n.changeLanguage(previousAppLanguage).catch(() => undefined)
          openSnackbar("error", i18n.t("language.saveError"))
        } finally {
          setIsSaving(false)
        }
      })()
    },
    [i18n, isSaving, openSnackbar, session, status],
  )

  return (
    <Flex direction="column" gap="1" align="start">
      <Text as="label" htmlFor={selectId} size="2" weight="bold">
        {t("language.label")}
      </Text>
      <Select.Root disabled={isSaving} size="2" value={value} onValueChange={handleValueChange}>
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
