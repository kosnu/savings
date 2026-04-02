import { Text } from "@radix-ui/themes"

import { BaseField, FieldLabel } from "../../../../components/inputs/BaseField"
import { toCurrency } from "../../../../utils/toCurrency"

interface AmountFieldProps {
  amount: number
}

export function AmountField({ amount }: AmountFieldProps) {
  return (
    <BaseField gap="2">
      <FieldLabel>Amount</FieldLabel>
      <Text size="4">{toCurrency(amount)}</Text>
    </BaseField>
  )
}
