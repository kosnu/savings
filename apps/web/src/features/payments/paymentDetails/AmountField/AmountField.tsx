import { Flex, Text } from "@radix-ui/themes"
import { useCallback, useEffect, useId, useRef, useState } from "react"

import { amountFieldSchema } from "../../../../domain/amount"
import { useSnackbar } from "../../../../providers/snackbar/SnackbarProvider"
import type { PaymentId } from "../../../../types/payment"
import { getZodErrorMessages } from "../../../../utils/getZodErrorMessages"
import { toCurrency } from "../../../../utils/toCurrency"
import { AmountInput } from "../../components/AmountInput"
import { useUpdatePayment } from "../../updatePayment/useUpdatePayment"
import { EditableField } from "../EditableField"
import { InlineForm } from "../InlineForm"
import { SubmitIconButton } from "../SubmitIconButton"

interface AmountFieldProps {
  paymentId?: PaymentId
  amount: number
  disabled?: boolean
  onEditStart: () => void
  onEditEnd: () => void
}

export function AmountField({
  paymentId,
  amount,
  disabled = false,
  onEditStart,
  onEditEnd,
}: AmountFieldProps) {
  const id = useId()
  const { openSnackbar } = useSnackbar()
  const { updatePayment, isPending } = useUpdatePayment()
  const [editing, setEditing] = useState(false)
  // 親が open=false を直接渡して field が unmount されるときに、編集中だった場合だけ onEditEnd を返す。
  const editingRef = useRef(false)
  const [draftAmount, setDraftAmount] = useState<string | undefined>(String(amount))
  const [messages, setMessages] = useState<string[] | undefined>()

  useEffect(() => {
    return () => {
      if (editingRef.current) {
        onEditEnd()
      }
    }
  }, [onEditEnd])

  const handleEdit = useCallback(() => {
    if (paymentId === undefined) return

    setDraftAmount(String(amount))
    setMessages(undefined)
    editingRef.current = true
    setEditing(true)
    onEditStart()
  }, [amount, onEditStart, paymentId])

  const handleCancel = useCallback(() => {
    if (isPending) return

    setDraftAmount(String(amount))
    setMessages(undefined)
    editingRef.current = false
    setEditing(false)
    onEditEnd()
  }, [amount, isPending, onEditEnd])

  const handleChange = useCallback((nextAmount: string) => {
    setDraftAmount(nextAmount)
    setMessages(undefined)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (paymentId === undefined || isPending) return

    const result = amountFieldSchema.safeParse(draftAmount)

    if (!result.success) {
      setMessages(getZodErrorMessages(result.error))
      return
    }

    if (result.data === amount) {
      setMessages(undefined)
      editingRef.current = false
      setEditing(false)
      onEditEnd()
      return
    }

    try {
      setMessages(undefined)
      await updatePayment({
        paymentId,
        patch: { amount: result.data },
      })
      editingRef.current = false
      setEditing(false)
      onEditEnd()
    } catch {
      const message = "Failed to update amount."

      setMessages([message])
      openSnackbar("error", message)
    }
  }, [amount, draftAmount, isPending, onEditEnd, openSnackbar, paymentId, updatePayment])

  return (
    <EditableField
      label="Amount"
      htmlFor={id}
      required
      editing={editing}
      disabled={disabled && !editing}
      editButtonLabel="Edit amount"
      onEdit={handleEdit}
      error={Boolean(messages?.length)}
      messages={messages}
      view={
        <Text size="4" style={{ flex: 1 }}>
          {toCurrency(amount)}
        </Text>
      }
      editor={
        <InlineForm onSubmit={handleSubmit} onCancel={handleCancel} saving={isPending}>
          <Flex align="center" gap="2">
            <div style={{ flex: 1 }}>
              <AmountInput
                id={id}
                value={draftAmount}
                onChange={handleChange}
                autoFocus
                disabled={isPending}
              />
            </div>
            <SubmitIconButton ariaLabel="Save amount" loading={isPending} />
          </Flex>
        </InlineForm>
      }
    />
  )
}
