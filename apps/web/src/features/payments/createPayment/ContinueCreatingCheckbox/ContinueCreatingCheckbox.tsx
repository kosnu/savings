import { Checkbox, Flex, Text } from "@radix-ui/themes"
import { useId } from "react"
import { useTranslation } from "react-i18next"

interface ContinueCreatingCheckboxProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

export function ContinueCreatingCheckbox({
  checked,
  onCheckedChange,
}: ContinueCreatingCheckboxProps) {
  const checkboxId = useId()
  const { t } = useTranslation()

  return (
    <Text as="label" size="2" htmlFor={checkboxId}>
      <Flex gap="2" align="center">
        <Checkbox
          id={checkboxId}
          checked={checked}
          onCheckedChange={(nextChecked) => onCheckedChange(nextChecked === true)}
        />
        {t("payments.create.continue")}
      </Flex>
    </Text>
  )
}
