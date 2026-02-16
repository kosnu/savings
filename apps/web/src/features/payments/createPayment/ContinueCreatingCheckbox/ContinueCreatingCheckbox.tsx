import { Checkbox, Flex, Text } from "@radix-ui/themes"
import { useId } from "react"

interface ContinueCreatingCheckboxProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

export function ContinueCreatingCheckbox({
  checked,
  onCheckedChange,
}: ContinueCreatingCheckboxProps) {
  const checkboxId = useId()

  return (
    <Text as="label" size="2" htmlFor={checkboxId}>
      <Flex gap="2" align="center">
        <Checkbox
          id={checkboxId}
          checked={checked}
          onCheckedChange={(nextChecked) =>
            onCheckedChange(nextChecked === true)
          }
        />
        Continue creating
      </Flex>
    </Text>
  )
}
