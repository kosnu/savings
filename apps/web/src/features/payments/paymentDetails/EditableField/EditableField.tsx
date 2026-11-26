import { Pencil1Icon } from "@radix-ui/react-icons"
import { Box, Button, Flex } from "@radix-ui/themes"
import type { ReactNode } from "react"

import { BaseField, FieldLabel, FieldMessages } from "../../../../components/inputs/BaseField"

interface EditableFieldProps {
  label: ReactNode
  htmlFor?: string
  required?: boolean
  editing: boolean
  disabled?: boolean
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
  disabled = false,
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
        <Flex minHeight={{ initial: "44px", sm: "32px" }}>
          <Button
            type="button"
            variant="ghost"
            color="gray"
            highContrast
            aria-label={editButtonLabel}
            disabled={disabled}
            onClick={onEdit}
            style={{
              width: "100%",
              boxSizing: "border-box",
              height: "auto",
              display: "inline-flex",
              textAlign: "left",
              justifyContent: "start",
              alignItems: "center",
              padding: "var(--space-1) var(--space-2)",
              margin: 0,
              whiteSpace: "normal",
            }}
          >
            <Flex as="span" flexGrow="1" minWidth="0" style={{ overflowWrap: "anywhere" }}>
              {view}
            </Flex>
            <Box asChild flexShrink="0">
              <Pencil1Icon aria-hidden color="gray" />
            </Box>
          </Button>
        </Flex>
      )}
    </BaseField>
  )
}
