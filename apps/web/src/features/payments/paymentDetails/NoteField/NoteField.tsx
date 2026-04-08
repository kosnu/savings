import { Flex, Text } from "@radix-ui/themes"
import {
  type KeyboardEvent,
  type ReactNode,
  type SubmitEvent,
  useCallback,
  useEffect,
  useId,
  useState,
} from "react"

import { useSnackbar } from "../../../../providers/snackbar"
import type { PaymentId } from "../../../../types/payment"
import { NoteInput } from "../../components/NoteInput"
import { useUpdatePayment } from "../../updatePayment/useUpdatePayment"
import { EditableField } from "../EditableField"
import { SubmitIconButton } from "../SubmitIconButton"

const notePlaceholder = "No note"

interface NoteFieldProps {
  paymentId: PaymentId
  note: string
  disabled?: boolean
  onEditingChange?: (editing: boolean) => void
}

export function NoteField({ paymentId, note, disabled = false, onEditingChange }: NoteFieldProps) {
  const id = useId()
  const { openSnackbar } = useSnackbar()
  const { updatePayment, isPending } = useUpdatePayment()
  const [editing, setEditing] = useState(false)
  const [draftNote, setDraftNote] = useState(note)
  const [messages, setMessages] = useState<string[] | undefined>()
  const hasNote = note.trim().length > 0
  const value = hasNote ? note : notePlaceholder

  useEffect(() => {
    onEditingChange?.(editing)
  }, [editing, onEditingChange])

  useEffect(() => {
    return () => {
      onEditingChange?.(false)
    }
  }, [onEditingChange])

  const handleEdit = useCallback(() => {
    setDraftNote(note)
    setMessages(undefined)
    setEditing(true)
  }, [note])

  const handleCancel = useCallback(() => {
    if (isPending) return

    setDraftNote(note)
    setMessages(undefined)
    setEditing(false)
  }, [isPending, note])

  const handleChange = useCallback((nextNote: string) => {
    setDraftNote(nextNote)
    setMessages(undefined)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (isPending) return

    if (draftNote === note) {
      setMessages(undefined)
      setEditing(false)
      return
    }

    try {
      setMessages(undefined)
      await updatePayment({
        paymentId,
        patch: { note: draftNote },
      })
      setEditing(false)
    } catch {
      const message = "Failed to update note."

      setMessages([message])
      openSnackbar("error", message)
    }
  }, [draftNote, isPending, note, openSnackbar, paymentId, updatePayment])

  return (
    <EditableField
      label="Note"
      htmlFor={id}
      editing={editing}
      disabled={disabled}
      editButtonLabel="Edit note"
      onEdit={handleEdit}
      error={Boolean(messages?.length)}
      messages={messages}
      view={
        <Text
          size="4"
          color={hasNote ? undefined : "gray"}
          style={{
            flex: 1,
            minHeight: "1.75rem",
            fontStyle: hasNote ? "normal" : "italic",
          }}
        >
          {value}
        </Text>
      }
      editor={
        <InlineForm onSubmit={handleSubmit} onCancel={handleCancel} saving={isPending}>
          <Flex align="center" gap="2">
            <div style={{ flex: 1 }}>
              <NoteInput
                autoFocus
                disabled={isPending}
                id={id}
                value={draftNote}
                onChange={handleChange}
              />
            </div>
            <SubmitIconButton ariaLabel="Save note" loading={isPending} />
          </Flex>
        </InlineForm>
      }
    />
  )
}

interface InlineFormProps {
  children: ReactNode
  onSubmit?: () => void | Promise<void>
  onCancel?: () => void
  saving?: boolean
}

function InlineForm({ children, onSubmit, onCancel, saving = false }: InlineFormProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Escape") return

    event.preventDefault()
    event.stopPropagation()
    if (!saving) {
      onCancel?.()
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    event.stopPropagation()
    onSubmit?.()
  }

  return (
    <form onKeyDownCapture={handleKeyDown} onSubmit={handleSubmit}>
      {children}
    </form>
  )
}
