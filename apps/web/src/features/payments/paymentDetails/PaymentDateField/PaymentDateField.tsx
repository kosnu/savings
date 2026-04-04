import { Text } from "@radix-ui/themes"

import { BaseField, FieldLabel } from "../../../../components/inputs/BaseField"
import { formatDateToLocaleString } from "../../../../utils/formatter/formatDateToLocaleString"

interface PaymentDateFieldProps {
  date: Date
}

export function PaymentDateField({ date }: PaymentDateFieldProps) {
  return (
    <BaseField gap="2">
      <FieldLabel>Date</FieldLabel>
      <Text size="4">{formatDateToLocaleString(date)}</Text>
    </BaseField>
  )
}
