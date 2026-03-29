import { TextField } from "@radix-ui/themes"
import { useId } from "react"

import { BaseField, FieldLabel, FieldMessages } from "../../../../components/inputs/BaseField"

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
      <TextField.Root
        id={id}
        name="note"
        type="text"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      />
      <FieldMessages error={error} messages={messages} />
    </BaseField>
  )
}
