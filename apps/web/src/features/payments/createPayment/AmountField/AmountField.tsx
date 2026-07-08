import { useId } from "react"
import { useTranslation } from "react-i18next"

import { BaseField, FieldLabel, FieldMessages } from "../../../../components/inputs/BaseField"
import { toAmountFormValue } from "../../../../domain/amount"
import { AmountInput } from "../../components/AmountInput"

interface AmountFieldProps {
  error?: boolean
  messages?: string[]
  value?: string | number
  onChange?: (amount: string) => void
  autoFocus?: boolean
}

export function AmountField({ error, messages, value, onChange, autoFocus }: AmountFieldProps) {
  const id = useId()
  const { t } = useTranslation()

  return (
    <BaseField>
      <FieldLabel htmlFor={id} required>
        {t("amount.label")}
      </FieldLabel>
      <AmountInput
        id={id}
        value={toAmountFormValue(value)}
        onChange={onChange}
        autoFocus={autoFocus}
      />
      <FieldMessages error={error} messages={messages} />
    </BaseField>
  )
}
