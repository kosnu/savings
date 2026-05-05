import { Flex, Text } from "@radix-ui/themes"
import { useCallback, useEffect, useId, useRef, useState } from "react"

import { useSnackbar } from "../../../../providers/snackbar"
import type { PaymentId } from "../../../../types/payment"
import { getZodErrorMessages } from "../../../../utils/getZodErrorMessages"
import { NoteInput } from "../../components/NoteInput"
import { noteFieldSchema } from "../../paymentFormSchema"
import { useUpdatePayment } from "../../updatePayment/useUpdatePayment"
import { EditableField } from "../EditableField"
import { InlineForm } from "../InlineForm"
import { SubmitIconButton } from "../SubmitIconButton"

const notePlaceholder = "No note"

interface NoteFieldProps {
  paymentId: PaymentId
  note: string
  disabled?: boolean
  onEditStart: () => void
  onEditEnd: () => void
}

export function NoteField({
  paymentId,
  note,
  disabled = false,
  onEditStart,
  onEditEnd,
}: NoteFieldProps) {
  const id = useId()
  const { openSnackbar } = useSnackbar()
  const { updatePayment, isPending } = useUpdatePayment()
  const [editing, setEditing] = useState(false)
  // 親が open=false を直接渡して field が unmount されるときに、編集中だった場合だけ onEditEnd を返す。
  const editingRef = useRef(false)
  const [draftNote, setDraftNote] = useState(note)
  const [messages, setMessages] = useState<string[] | undefined>()
  const hasNote = note.trim().length > 0
  const value = hasNote ? note : notePlaceholder

  useEffect(() => {
    return () => {
      if (editingRef.current) {
        onEditEnd()
      }
    }
  }, [onEditEnd])

  const handleEdit = useCallback(() => {
    setDraftNote(note)
    setMessages(undefined)
    editingRef.current = true
    setEditing(true)
    onEditStart()
  }, [note, onEditStart])

  const handleCancel = useCallback(() => {
    if (isPending) return

    setDraftNote(note)
    setMessages(undefined)
    editingRef.current = false
    setEditing(false)
    onEditEnd()
  }, [isPending, note, onEditEnd])

  const handleChange = useCallback((nextNote: string) => {
    setDraftNote(nextNote)
    setMessages(undefined)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (isPending) return

    if (draftNote === note) {
      setMessages(undefined)
      editingRef.current = false
      setEditing(false)
      onEditEnd()
      return
    }

    const result = noteFieldSchema.safeParse(draftNote)

    if (!result.success) {
      setMessages(getZodErrorMessages(result.error))
      return
    }

    try {
      setMessages(undefined)
      await updatePayment({
        paymentId,
        patch: { note: result.data },
      })
      editingRef.current = false
      setEditing(false)
      onEditEnd()
    } catch {
      const message = "Failed to update note."

      setMessages([message])
      openSnackbar("error", message)
    }
  }, [draftNote, isPending, note, onEditEnd, openSnackbar, paymentId, updatePayment])

  return (
    <EditableField
      label="Note"
      htmlFor={id}
      editing={editing}
      disabled={disabled && !editing}
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
