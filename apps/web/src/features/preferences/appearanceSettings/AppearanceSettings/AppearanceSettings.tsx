import { Flex, Heading } from "@radix-ui/themes"
import { useTranslation } from "react-i18next"

import { LanguageSelect } from "../LanguageSelect"
import { ThemeSelect } from "../ThemeSelect"

import styles from "./AppearanceSettings.module.css"

const headingId = "appearance-settings-heading"

export function AppearanceSettings() {
  const { t } = useTranslation()

  return (
    <Flex direction="column" gap="3">
      <Heading id={headingId} as="h2" size="4">
        {t("appearance.title")}
      </Heading>
      <fieldset aria-labelledby={headingId} className={styles.fieldset}>
        <Flex direction="column" gap="3" align="start">
          <LanguageSelect />
          <ThemeSelect />
        </Flex>
      </fieldset>
    </Flex>
  )
}
