import { Text } from "@radix-ui/themes"
import { format } from "date-fns"
import { useCallback, useEffect, useId, useRef, useState } from "react"

import { DatePicker } from "../../../../components/inputs/DatePicker"
import { useSnackbar } from "../../../../providers/snackbar/SnackbarProvider"
import type { PaymentId } from "../../../../types/payment"
import { formatDateToLocaleString } from "../../../../utils/formatter/formatDateToLocaleString"
import { getZodErrorMessages } from "../../../../utils/getZodErrorMessages"
import { dateFieldSchema } from "../../paymentFormSchema"
import { useUpdatePayment } from "../../updatePayment/useUpdatePayment"
import { EditableField } from "../EditableField"

interface PaymentDateFieldProps {
  paymentId: PaymentId
  date: Date
  disabled?: boolean
  onEditStart: () => void
  onEditEnd: () => void
}

export function PaymentDateField({
  paymentId,
  date,
  disabled = false,
  onEditStart,
  onEditEnd,
}: PaymentDateFieldProps) {
  const id = useId()
  const { openSnackbar } = useSnackbar()
  const { updatePayment, isPending } = useUpdatePayment()
  const [editing, setEditing] = useState(false)
  const editingRef = useRef(false)
  const [draftDate, setDraftDate] = useState<Date | undefined>(date)
  const [messages, setMessages] = useState<string[] | undefined>()

  useEffect(() => {
    return () => {
      if (editingRef.current) {
        onEditEnd()
      }
    }
  }, [onEditEnd])

  const closeEditor = useCallback(() => {
    if (!editingRef.current) return

    editingRef.current = false
    setEditing(false)
    onEditEnd()
  }, [onEditEnd])

  const handleEdit = useCallback(() => {
    setDraftDate(date)
    setMessages(undefined)
    editingRef.current = true
    setEditing(true)
    onEditStart()
  }, [date, onEditStart])

  const handleCancel = useCallback(() => {
    if (isPending) return

    setDraftDate(date)
    setMessages(undefined)
    closeEditor()
  }, [closeEditor, date, isPending])

  const handleChange = useCallback(
    async (nextDate: Date | undefined) => {
      if (isPending) return

      const result = dateFieldSchema.safeParse(nextDate)

      if (!result.success) {
        setMessages(getZodErrorMessages(result.error))
        return
      }

      setDraftDate(result.data)

      if (toDateOnlyKey(result.data) === toDateOnlyKey(date)) {
        setMessages(undefined)
        closeEditor()
        return
      }

      try {
        setMessages(undefined)
        await updatePayment({
          paymentId,
          patch: { date: result.data },
        })
        closeEditor()
      } catch {
        const message = "Failed to update date."

        setMessages([message])
        openSnackbar("error", message)
      }
    },
    [closeEditor, date, isPending, openSnackbar, paymentId, updatePayment],
  )

  return (
    <EditableField
      label="Date"
      htmlFor={id}
      required
      editing={editing}
      disabled={disabled && !editing}
      editButtonLabel="Edit date"
      onEdit={handleEdit}
      error={Boolean(messages?.length)}
      messages={messages}
      view={
        <Text size="4" style={{ flex: 1 }}>
          {formatDateToLocaleString(date)}
        </Text>
      }
      editor={
        <DatePicker
          autoFocus
          disabled={isPending}
          id={id}
          name="date"
          required
          value={draftDate}
          onChange={handleChange}
          onEscapeKeyDown={handleCancel}
        />
      }
    />
  )
}

function toDateOnlyKey(date: Date): string {
  return format(date, "yyyy-MM-dd")
}
