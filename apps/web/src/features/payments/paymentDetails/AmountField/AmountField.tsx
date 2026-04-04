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
import type { Payment } from "../../../../types/payment"
import { getZodErrorMessages } from "../../../../utils/getZodErrorMessages"
import { toCurrency } from "../../../../utils/toCurrency"
import { AmountInput } from "../../components/AmountInput"
import { amountFieldSchema } from "../../paymentFormSchema"
import { useUpdatePayment } from "../../updatePayment/useUpdatePayment"
import { EditableField } from "../EditableField"
import { SubmitIconButton } from "../SubmitIconButton"

interface AmountFieldProps {
  paymentId?: Payment["id"]
  amount: number
  onEditingChange?: (editing: boolean) => void
}

export function AmountField({ paymentId, amount, onEditingChange }: AmountFieldProps) {
  const id = useId()
  const { openSnackbar } = useSnackbar()
  const { updatePayment, isPending } = useUpdatePayment()
  const [editing, setEditing] = useState(false)
  const [committedAmount, setCommittedAmount] = useState(amount)
  const [draftAmount, setDraftAmount] = useState<number | undefined>(amount)
  const [messages, setMessages] = useState<string[] | undefined>()

  useEffect(() => {
    onEditingChange?.(editing)
  }, [editing, onEditingChange])

  useEffect(() => {
    return () => {
      onEditingChange?.(false)
    }
  }, [onEditingChange])

  const handleEdit = useCallback(() => {
    if (paymentId === undefined) return

    setDraftAmount(committedAmount)
    setMessages(undefined)
    setEditing(true)
  }, [committedAmount, paymentId])

  const handleCancel = useCallback(() => {
    if (isPending) return

    setDraftAmount(committedAmount)
    setMessages(undefined)
    setEditing(false)
  }, [committedAmount, isPending])

  const handleChange = useCallback((nextAmount: number | undefined) => {
    setDraftAmount(nextAmount)
    setMessages(undefined)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (paymentId === undefined || isPending) return

    if (draftAmount === committedAmount) {
      setMessages(undefined)
      setEditing(false)
      return
    }

    const result = amountFieldSchema.safeParse(draftAmount)

    if (!result.success) {
      setMessages(getZodErrorMessages(result.error))
      return
    }

    try {
      setMessages(undefined)
      await updatePayment({
        paymentId,
        patch: { amount: result.data },
      })
      setCommittedAmount(result.data)
      setDraftAmount(result.data)
      setEditing(false)
    } catch {
      const message = "Failed to update amount."

      setMessages([message])
      openSnackbar("error", message)
    }
  }, [committedAmount, draftAmount, isPending, openSnackbar, paymentId, updatePayment])

  return (
    <EditableField
      label="Amount"
      htmlFor={id}
      required
      editing={editing}
      editButtonLabel="Edit amount"
      onEdit={handleEdit}
      error={Boolean(messages?.length)}
      messages={messages}
      view={
        <Text size="4" style={{ flex: 1 }}>
          {toCurrency(committedAmount)}
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
