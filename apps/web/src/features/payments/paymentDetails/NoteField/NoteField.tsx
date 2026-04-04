import { Text } from "@radix-ui/themes"

import { BaseField, FieldLabel } from "../../../../components/inputs/BaseField"

const notePlaceholder = "No note"

interface NoteFieldProps {
  note: string
}

export function NoteField({ note }: NoteFieldProps) {
  const hasNote = note.trim().length > 0
  const value = hasNote ? note : notePlaceholder

  return (
    <BaseField gap="2">
      <FieldLabel>Note</FieldLabel>
      <Text
        size="4"
        color={hasNote ? undefined : "gray"}
        style={{ minHeight: "1.75rem", fontStyle: hasNote ? "normal" : "italic" }}
      >
        {value}
      </Text>
    </BaseField>
  )
}
