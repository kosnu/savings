import { useId } from "react"
import { useTranslation } from "react-i18next"

import { BaseField, FieldLabel, FieldMessages } from "../../../../components/inputs/BaseField"
import { NoteInput } from "../../components/NoteInput"

interface NoteFieldProps {
  error?: boolean
  messages?: string[]
  value?: string
  onChange?: (note: string) => void
}

export function NoteField({ error, messages, value, onChange }: NoteFieldProps) {
  const id = useId()
  const { t } = useTranslation()

  return (
    <BaseField>
      <FieldLabel htmlFor={id}>{t("payments.note.label")}</FieldLabel>
      <NoteInput id={id} value={value} onChange={onChange} />
      <FieldMessages error={error} messages={messages} />
    </BaseField>
  )
}
