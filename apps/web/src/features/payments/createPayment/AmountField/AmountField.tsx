import { useId } from "react"

import { BaseField, FieldLabel, FieldMessages } from "../../../../components/inputs/BaseField"
import { AmountInput } from "../../components/AmountInput"

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
