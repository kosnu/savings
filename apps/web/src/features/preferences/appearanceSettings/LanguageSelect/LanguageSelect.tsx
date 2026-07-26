import { Flex, Select, Text } from "@radix-ui/themes"
import { useCallback } from "react"
import { useTranslation } from "react-i18next"

import { appLanguageLabelKeys, appLanguages, toAppLanguage } from "../../../../i18n"

const selectId = "appearance-language"

export function LanguageSelect() {
  const { i18n, t } = useTranslation()
  const value = toAppLanguage(i18n.resolvedLanguage)

  const handleValueChange = useCallback(
    (nextLanguage: string) => {
      void i18n.changeLanguage(toAppLanguage(nextLanguage))
    },
    [i18n],
  )

  return (
    <Flex direction="column" gap="1" align="start">
      <Text as="label" htmlFor={selectId} size="2" weight="bold">
        {t("language.label")}
      </Text>
      <Select.Root size="2" value={value} onValueChange={handleValueChange}>
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
