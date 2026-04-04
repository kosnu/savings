import { Pencil1Icon } from "@radix-ui/react-icons"
import { Button, Flex } from "@radix-ui/themes"
import type { ReactNode } from "react"

import { BaseField, FieldLabel, FieldMessages } from "../../../../components/inputs/BaseField"

interface EditableFieldProps {
  label: ReactNode
  htmlFor?: string
  required?: boolean
  editing: boolean
  view: ReactNode
  editor: ReactNode
  editButtonLabel: string
  onEdit?: () => void
  error?: boolean
  messages?: string[]
}

export function EditableField({
  label,
  htmlFor,
  required = false,
  editing,
  view,
  editor,
  editButtonLabel,
  onEdit,
  error = false,
  messages,
}: EditableFieldProps) {
  return (
    <BaseField gap="2">
      <FieldLabel htmlFor={htmlFor} required={required}>
        {label}
      </FieldLabel>
      {editing ? (
        <>
          {editor}
          <FieldMessages error={error} messages={messages} />
        </>
      ) : (
        <Flex style={{ height: "32px" }}>
          <Button
            type="button"
            variant="ghost"
            color="gray"
            highContrast
            aria-label={editButtonLabel}
            onClick={onEdit}
            style={{
              width: "100%",
              height: "auto",
              display: "inline-flex",
              textAlign: "left",
              justifyContent: "start",
              alignItems: "center",
              padding: "3px 0.375rem",
            }}
          >
            {view}
            <Pencil1Icon aria-hidden color="gray" />
          </Button>
        </Flex>
      )}
    </BaseField>
  )
}
