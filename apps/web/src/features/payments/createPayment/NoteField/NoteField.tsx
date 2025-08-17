import { Text, TextField } from "@radix-ui/themes"
import { Fragment, useId } from "react"
import { BaseField } from "../../../../components/inputs/BaseField"

interface NoteFieldProps {
  error?: boolean
  messages?: string[]
}

export function NoteField({ error, messages }: NoteFieldProps) {
  const id = useId()

  return (
    <BaseField
      label="Note"
      required
      htmlFor={id}
      error={error}
      message={messages?.map((msg, i) => (
        <Fragment key={msg}>
          {i > 0 && <br />}
          <Text as="span">{msg}</Text>
        </Fragment>
      ))}
    >
      <TextField.Root id={id} name="note" type="text" />
    </BaseField>
  )
}
