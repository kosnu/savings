import { useId } from "react"

import { AmountInput } from "../../../../components/inputs/AmountInput"
import { BaseField, FieldLabel, FieldMessages } from "../../../../components/inputs/BaseField"
import { toAmountInputValue } from "../../../../utils/amountInputValue"

interface AmountFieldProps {
  error?: boolean
  messages?: string[]
  value?: string | number
  onChange?: (amount: string) => void
  autoFocus?: boolean
}

export function AmountField({ error, messages, value, onChange, autoFocus }: AmountFieldProps) {
  const id = useId()

  return (
    <BaseField>
      <FieldLabel htmlFor={id} required>
        Amount
      </FieldLabel>
      <AmountInput
        id={id}
        value={toAmountInputValue(value)}
        onChange={onChange}
        autoFocus={autoFocus}
      />
      <FieldMessages error={error} messages={messages} />
    </BaseField>
  )
}
