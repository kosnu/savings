import { useId } from "react"
import { useTranslation } from "react-i18next"

import { BaseField, FieldLabel, FieldMessages } from "../../../../components/inputs/BaseField"
import { DatePicker } from "../../../../components/inputs/DatePicker"

interface PaymentDateFieldProps {
  error?: boolean
  messages?: string[]
  value?: Date
  onChange?: (date: Date | undefined) => void
}

export function PaymentDateField({ error, messages, value, onChange }: PaymentDateFieldProps) {
  const id = useId()
  const { t } = useTranslation()

  return (
    <BaseField width="fit-content">
      <FieldLabel htmlFor={id} required>
        {t("date.label")}
      </FieldLabel>
      <DatePicker id={id} name="date" value={value} onChange={onChange} />
      <FieldMessages error={error} messages={messages} />
    </BaseField>
  )
}
