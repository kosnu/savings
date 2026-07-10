import { useId } from "react"
import { useTranslation } from "react-i18next"

import { BaseField, FieldLabel, FieldMessages } from "../../../../components/inputs/BaseField"
import { MonthPicker } from "../../../../components/inputs/MonthPicker"

interface MonthFieldProps {
  error?: boolean
  messages?: string[]
  value?: Date
  onChange?: (targetMonth: Date | undefined) => void
}

export function MonthField({ error, messages, value, onChange }: MonthFieldProps) {
  const id = useId()
  const { t } = useTranslation()

  return (
    <BaseField>
      <FieldLabel htmlFor={id} required>
        {t("date.month")}
      </FieldLabel>
      <MonthPicker id={id} value={value} onChange={onChange} />
      <FieldMessages error={error} messages={messages} />
    </BaseField>
  )
}
