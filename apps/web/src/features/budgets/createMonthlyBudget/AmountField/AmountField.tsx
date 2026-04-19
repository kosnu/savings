import { useId } from "react"

import { AmountInput } from "../../../../components/inputs/AmountInput"
import { BaseField, FieldLabel, FieldMessages } from "../../../../components/inputs/BaseField"

interface AmountFieldProps {
  error?: boolean
  messages?: string[]
  value?: number
  onChange?: (amount: number | undefined) => void
  autoFocus?: boolean
}

export function AmountField({ error, messages, value, onChange, autoFocus }: AmountFieldProps) {
  const id = useId()

  return (
    <BaseField>
      <FieldLabel htmlFor={id} required>
        Amount
      </FieldLabel>
      <AmountInput id={id} value={value} onChange={onChange} autoFocus={autoFocus} />
      <FieldMessages error={error} messages={messages} />
    </BaseField>
  )
}
