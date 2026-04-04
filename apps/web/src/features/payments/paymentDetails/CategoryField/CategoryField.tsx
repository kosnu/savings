import { Text } from "@radix-ui/themes"

import { BaseField, FieldLabel } from "../../../../components/inputs/BaseField"

interface CategoryFieldProps {
  categoryName: string
}

export function CategoryField({ categoryName }: CategoryFieldProps) {
  return (
    <BaseField gap="2">
      <FieldLabel>Category</FieldLabel>
      <Text size="4">{categoryName}</Text>
    </BaseField>
  )
}
