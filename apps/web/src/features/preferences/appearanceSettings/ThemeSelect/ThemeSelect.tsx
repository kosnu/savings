import { Flex, Select, Text } from "@radix-ui/themes"
import { useCallback } from "react"
import { useTranslation } from "react-i18next"

import { useTheme } from "../../../../providers/theme/ThemeProvider"
import { isTheme } from "../../../../providers/theme/types"

const selectId = "appearance-theme"

export function ThemeSelect() {
  const { changeTheme, theme } = useTheme()
  const { t } = useTranslation()

  const handleValueChange = useCallback(
    (nextTheme: string) => {
      if (isTheme(nextTheme)) changeTheme(nextTheme)
    },
    [changeTheme],
  )

  return (
    <Flex direction="column" gap="1" align="start">
      <Text as="label" htmlFor={selectId} size="2" weight="bold">
        {t("theme.label")}
      </Text>
      <Select.Root size="2" value={theme} onValueChange={handleValueChange}>
        <Select.Trigger id={selectId} />
        <Select.Content>
          <Select.Item value="light">{t("theme.light")}</Select.Item>
          <Select.Item value="dark">{t("theme.dark")}</Select.Item>
        </Select.Content>
      </Select.Root>
    </Flex>
  )
}
