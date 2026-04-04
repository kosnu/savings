import { useId } from "react"

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

  return (
    <BaseField>
      <FieldLabel htmlFor={id}>Note</FieldLabel>
      <NoteInput id={id} value={value} onChange={onChange} />
      <FieldMessages error={error} messages={messages} />
    </BaseField>
  )
}
