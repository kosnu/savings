import { Flex, Text } from "@radix-ui/themes"
import { useTranslation } from "react-i18next"

import { Logo } from "../../components/misc/Logo"

export function AuthLoadingScreen() {
  const { t } = useTranslation()

  return (
    <Flex align="center" direction="column" gap="3" justify="center" minHeight="100vh" asChild>
      <output aria-live="polite">
        <Logo width={96} height={96} animated alt="" />
        <Text color="gray" size="2">
          {t("auth.loading")}
        </Text>
      </output>
    </Flex>
  )
}
