import { Flex, Text } from "@radix-ui/themes"
import { useTranslation } from "react-i18next"

import { LanguageSelect } from "../LanguageSelect"

export function ProfileSettings() {
  const { t } = useTranslation()

  return (
    <Flex direction="column" gap="5">
      <Flex direction="column" gap="3" align="start">
        <Text as="p" size="4" weight="medium">
          {t("profile.language")}
        </Text>
        <LanguageSelect />
      </Flex>
    </Flex>
  )
}
