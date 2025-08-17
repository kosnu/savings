import { TextField } from "@radix-ui/themes"
import { useId } from "react"
import { BaseField } from "../../../../components/inputs/BaseField"

interface NoteFieldProps {
  error?: boolean
  message?: string
}

export function NoteField({ error, message }: NoteFieldProps) {
  const id = useId()

  return (
    <BaseField
      label="Note"
      required
      htmlFor={id}
      error={error}
      message={message}
    >
      <TextField.Root id={id} name="note" type="text" />
    </BaseField>
  )
}
