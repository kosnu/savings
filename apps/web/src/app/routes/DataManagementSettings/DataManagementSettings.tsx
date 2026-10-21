import { Flex, Heading } from "@radix-ui/themes"
import { useTranslation } from "react-i18next"

import { ExportPayments } from "../../../features/payments"

export function DataManagementSettings() {
  const { t } = useTranslation()
  return (
    <Flex direction="column" gap="4">
      <Heading as="h2" size="5">
        {t("settings.dataManagement")}
      </Heading>
      <ExportPayments />
    </Flex>
  )
}
