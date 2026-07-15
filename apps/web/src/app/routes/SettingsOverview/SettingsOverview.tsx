import { Flex, Separator, Text } from "@radix-ui/themes"
import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import styles from "./SettingsOverview.module.css"

export function SettingsOverview() {
  const { t } = useTranslation()

  return (
    <Flex direction="column" gap="4">
      <Text as="p" size="3" color="gray">
        {t("settings.overviewDescription")}
      </Text>
      <nav aria-label={t("settings.overviewLinks")}>
        <Flex direction="column" gap="0">
          <Link to="/settings/profile" className={styles.itemLink}>
            <Flex direction="column" gap="1">
              <Text as="span" size="4" weight="medium" className={styles.itemTitle}>
                {t("navigation.profile")}
              </Text>
              <Text as="span" size="3" color="gray">
                {t("settings.profileDescription")}
              </Text>
            </Flex>
          </Link>
          <Separator size="4" />
          <Link to="/settings/book" className={styles.itemLink}>
            <Flex direction="column" gap="1">
              <Text as="span" size="4" weight="medium" className={styles.itemTitle}>
                {t("navigation.book")}
              </Text>
              <Text as="span" size="3" color="gray">
                {t("settings.bookDescription")}
              </Text>
            </Flex>
          </Link>
        </Flex>
      </nav>
    </Flex>
  )
}
